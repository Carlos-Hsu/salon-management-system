-- Atomically archive appointments, void their financial records, and reverse checkout stock.
begin;

alter table public.orders
  add column if not exists voided_at timestamptz,
  add column if not exists void_reason text;

alter table public.finance_records
  add column if not exists voided_at timestamptz,
  add column if not exists void_reason text;

create index if not exists orders_active_idx
  on public.orders(appointment_id)
  where voided_at is null;
create index if not exists finance_records_active_occurred_idx
  on public.finance_records(occurred_at desc)
  where voided_at is null;

create or replace function public.archive_appointment(p_appointment_id bigint)
returns bigint
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_appointment public.appointments;
  v_order public.orders;
  v_line record;
  v_resulting_stock integer;
  v_voided_at timestamptz;
begin
  select * into v_appointment
  from public.appointments
  where id = p_appointment_id
  for update;
  if not found then raise exception 'Appointment not found'; end if;

  v_voided_at := coalesce(v_appointment.deleted_at, now());

  select * into v_order
  from public.orders
  where appointment_id = p_appointment_id
  for update;

  -- The voided_at guard makes stock reversal safe under retries and concurrent requests.
  if found and v_order.voided_at is null then
    for v_line in
      select product_id, sum(quantity)::integer as quantity
      from public.order_items
      where order_id = v_order.id and item_type = 'product'
      group by product_id
      order by product_id
    loop
      update public.products
      set stock = stock + v_line.quantity
      where id = v_line.product_id
      returning stock into v_resulting_stock;
      if not found then raise exception 'Product % not found while voiding order %', v_line.product_id, v_order.id; end if;

      insert into public.stock_adjustments(product_id,order_id,quantity_delta,resulting_stock,reason)
      values(v_line.product_id,v_order.id,v_line.quantity,v_resulting_stock,'Voided archived appointment');
    end loop;

    update public.orders
    set voided_at = v_voided_at,
        void_reason = 'Appointment archived'
    where id = v_order.id and voided_at is null;
  end if;

  update public.finance_records
  set voided_at = coalesce(voided_at,v_voided_at),
      void_reason = coalesce(void_reason,'Appointment archived'),
      updated_at = now()
  where appointment_id = p_appointment_id
     or (v_order.id is not null and order_id = v_order.id);

  update public.appointments
  set deleted_at = coalesce(deleted_at,v_voided_at)
  where id = p_appointment_id;

  return p_appointment_id;
end
$$;

revoke all on function public.archive_appointment(bigint) from public, anon;
grant execute on function public.archive_appointment(bigint) to authenticated;

-- Repair appointments archived by the previous migration before financial voiding existed.
do $$
declare v_appointment_id bigint;
begin
  for v_appointment_id in
    select id from public.appointments where deleted_at is not null order by id
  loop
    perform public.archive_appointment(v_appointment_id);
  end loop;
end
$$;

commit;
