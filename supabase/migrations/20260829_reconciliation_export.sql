-- Add reconciliation exports, checkout operator attribution, and additional payment channels.
begin;

alter table public.orders
  add column if not exists handled_by uuid references public.profiles(id) on delete set null;

alter table public.orders drop constraint if exists orders_payment_method_check;
-- Older deployments may contain display labels or legacy channel codes that
-- predate the normalized values used by the export filters.
update public.orders
set payment_method = case lower(btrim(payment_method))
  when 'cash' then 'cash'
  when '現金' then 'cash'
  when 'card' then 'credit_card'
  when 'credit' then 'credit_card'
  when 'credit_card' then 'credit_card'
  when 'credit-card' then 'credit_card'
  when '信用卡' then 'credit_card'
  when 'line' then 'line_pay'
  when 'linepay' then 'line_pay'
  when 'line_pay' then 'line_pay'
  when 'line pay' then 'line_pay'
  when '轉帳' then 'bank_transfer'
  when 'bank' then 'bank_transfer'
  when 'transfer' then 'bank_transfer'
  when 'bank_transfer' then 'bank_transfer'
  when 'bank-transfer' then 'bank_transfer'
  else payment_method
end;

do $$
declare invalid_methods text;
begin
  select string_agg(format('%L', payment_method), ', ' order by payment_method)
  into invalid_methods
  from (select distinct payment_method from public.orders
        where payment_method not in ('cash','credit_card','line_pay','bank_transfer')) invalid;
  if invalid_methods is not null then
    raise exception using errcode='22023', message=format('Unsupported legacy payment_method values: %s. Normalize them before rerunning this migration.', invalid_methods);
  end if;
end $$;

alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('cash','credit_card','line_pay','bank_transfer'));

create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_handled_by_created_idx on public.orders(handled_by,created_at desc);

create or replace function public.sync_order_income()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare v_start_time timestamptz; v_notes text;
begin
  select start_time into strict v_start_time from public.appointments where id=new.appointment_id;
  v_notes:=case new.payment_method
    when 'cash' then '現金'
    when 'credit_card' then '信用卡'
    when 'line_pay' then 'LINE Pay'
    when 'bank_transfer' then '轉帳'
    else new.payment_method
  end;
  insert into public.finance_records(type,category,amount,occurred_at,notes,source,appointment_id,order_id)
  values ('income','服務／產品銷售',new.total_amount,v_start_time,v_notes,'order',new.appointment_id,new.id)
  on conflict (appointment_id) do update set amount=excluded.amount,occurred_at=excluded.occurred_at,
    notes=excluded.notes,order_id=excluded.order_id,source='order',updated_at=now();
  return new;
end $$;

create or replace function public.checkout_appointment(
  p_appointment_id bigint,
  p_idempotency_key text,
  p_product_items jsonb default '[]',
  p_custom_items jsonb default '[]',
  p_payment_method text default 'cash',
  p_discount bigint default 0
)
returns table(order_id bigint,total_amount bigint)
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_app public.appointments; v_order public.orders; v_service_name text; v_service_amount bigint; v_product_amount bigint:=0; v_custom_amount bigint:=0; v_item jsonb; v_product public.products; v_qty integer; v_total bigint;
begin
  select * into strict v_app from public.appointments where id=p_appointment_id for update;
  select * into v_order from public.orders where idempotency_key=p_idempotency_key;
  if found then
    if v_order.appointment_id<>p_appointment_id then raise exception 'Idempotency key already used'; end if;
    return query select v_order.id,v_order.total_amount; return;
  end if;
  if exists(select 1 from public.orders where appointment_id=p_appointment_id) then raise exception 'Appointment was already checked out with another idempotency key'; end if;
  if v_app.status<>'in_service' then raise exception 'Only in-service appointments can be checked out'; end if;
  select name,price into strict v_service_name,v_service_amount from public.services where id=v_app.service_id;
  if jsonb_typeof(coalesce(p_product_items,'[]'))<>'array'
     or jsonb_typeof(coalesce(p_custom_items,'[]'))<>'array'
     or p_discount<0
     or p_payment_method not in ('cash','credit_card','line_pay','bank_transfer') then
    raise exception 'Invalid checkout items, discount, or payment method';
  end if;
  for v_item in select value from jsonb_array_elements(coalesce(p_product_items,'[]')) loop
    v_qty=(v_item->>'quantity')::integer;
    if v_qty<=0 then raise exception 'Product quantity must be positive'; end if;
    select * into strict v_product from public.products where id=(v_item->>'product_id')::bigint for update;
    if not v_product.active or v_product.stock<v_qty then raise exception 'Product unavailable or insufficient stock'; end if;
    v_product_amount:=v_product_amount+(v_product.price*v_qty);
  end loop;
  for v_item in select value from jsonb_array_elements(coalesce(p_custom_items,'[]')) loop
    if btrim(coalesce(v_item->>'name',''))='' or (v_item->>'amount')::bigint<0 then raise exception 'Invalid custom item'; end if;
    v_custom_amount:=v_custom_amount+(v_item->>'amount')::bigint;
  end loop;
  v_total:=greatest(0,v_service_amount+v_product_amount+v_custom_amount-p_discount);
  insert into public.orders(appointment_id,idempotency_key,service_amount,product_amount,custom_amount,discount,total_amount,payment_method,custom_items,handled_by)
  values(p_appointment_id,p_idempotency_key,v_service_amount,v_product_amount,v_custom_amount,p_discount,v_total,p_payment_method,coalesce(p_custom_items,'[]'),auth.uid())
  returning * into v_order;
  insert into public.order_items(order_id,item_type,name,quantity,unit_amount,line_amount)
  values(v_order.id,'service',v_service_name,1,v_service_amount,v_service_amount);
  for v_item in select value from jsonb_array_elements(coalesce(p_product_items,'[]')) loop
    v_qty=(v_item->>'quantity')::integer;
    select * into strict v_product from public.products where id=(v_item->>'product_id')::bigint for update;
    update public.products set stock=stock-v_qty where id=v_product.id and active and stock>=v_qty returning stock into v_product.stock;
    if not found then raise exception 'Product unavailable or insufficient stock'; end if;
    insert into public.order_items(order_id,item_type,product_id,name,quantity,unit_amount,line_amount)
    values(v_order.id,'product',v_product.id,v_product.name,v_qty,v_product.price,v_product.price*v_qty);
    insert into public.stock_adjustments(product_id,order_id,quantity_delta,resulting_stock,reason)
    values(v_product.id,v_order.id,-v_qty,v_product.stock,'Checkout');
  end loop;
  for v_item in select value from jsonb_array_elements(coalesce(p_custom_items,'[]')) loop
    insert into public.order_items(order_id,item_type,name,quantity,unit_amount,line_amount)
    values(v_order.id,'custom',v_item->>'name',1,(v_item->>'amount')::bigint,(v_item->>'amount')::bigint);
  end loop;
  perform set_config('app.checkout_appointment_id',p_appointment_id::text,true);
  update public.appointments set status='completed',total_amount=v_total,custom_items=coalesce(p_custom_items,'[]') where id=p_appointment_id;
  return query select v_order.id,v_order.total_amount;
end $$;

create or replace function public.get_reconciliation_staff()
returns table(id uuid, full_name text)
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id=auth.uid() and p.role in ('staff','super_admin')
  ) then raise exception using errcode='42501',message='Authenticated salon operator required'; end if;
  return query
    select p.id,coalesce(nullif(btrim(p.full_name),''),'未命名人員')
    from public.profiles p
    where p.role in ('staff','super_admin')
    order by coalesce(nullif(btrim(p.full_name),''),'未命名人員'),p.id;
end $$;

create or replace function public.get_reconciliation_report(
  p_start_date date,
  p_end_date date,
  p_status text default null,
  p_payment_method text default null,
  p_handled_by uuid default null
)
returns table(
  order_id bigint,
  appointment_id bigint,
  transaction_at timestamptz,
  order_status text,
  customer_name text,
  customer_phone text,
  item_details jsonb,
  original_amount bigint,
  discount_amount bigint,
  final_amount bigint,
  payment_method text,
  handled_by uuid,
  handled_by_name text,
  notes text
)
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles p where p.id=auth.uid() and p.role in ('staff','super_admin')
  ) then raise exception using errcode='42501',message='Authenticated salon operator required'; end if;
  if p_start_date is null or p_end_date is null or p_start_date>p_end_date then
    raise exception using errcode='22007',message='Invalid reconciliation date range';
  end if;
  if p_end_date-p_start_date>366 then
    raise exception using errcode='22023',message='Reconciliation date range cannot exceed 367 days';
  end if;
  if p_status is not null and p_status not in ('paid','refunded') then
    raise exception using errcode='22023',message='Invalid order status filter';
  end if;
  if p_payment_method is not null and p_payment_method not in ('cash','credit_card','line_pay','bank_transfer') then
    raise exception using errcode='22023',message='Invalid payment method filter';
  end if;

  return query
  select o.id,o.appointment_id,o.created_at,o.status::text,c.name,c.phone,
    coalesce(jsonb_agg(jsonb_build_object(
      'item_type',oi.item_type,'name',oi.name,'quantity',oi.quantity,
      'unit_amount',oi.unit_amount,'line_amount',oi.line_amount
    ) order by oi.id) filter (where oi.id is not null),'[]'::jsonb),
    o.service_amount+o.product_amount+o.custom_amount,o.discount,o.total_amount,
    o.payment_method,o.handled_by,
    case when o.handled_by is null then '未指定' else coalesce(nullif(btrim(p.full_name),''),'未命名人員') end,
    a.note
  from public.orders o
  join public.appointments a on a.id=o.appointment_id
  join public.customers c on c.id=a.customer_id
  left join public.order_items oi on oi.order_id=o.id
  left join public.profiles p on p.id=o.handled_by
  where o.created_at >= (p_start_date::timestamp at time zone 'Asia/Taipei')
    and o.created_at < ((p_end_date+1)::timestamp at time zone 'Asia/Taipei')
    and (p_status is null or o.status::text=p_status)
    and (p_payment_method is null or o.payment_method=p_payment_method)
    and (p_handled_by is null or o.handled_by=p_handled_by)
  group by o.id,a.id,c.id,p.id
  order by o.created_at,o.id;
end $$;

revoke execute on function public.get_reconciliation_staff() from public,anon;
revoke execute on function public.get_reconciliation_report(date,date,text,text,uuid) from public,anon;
revoke execute on function public.checkout_appointment(bigint,text,jsonb,jsonb,text,bigint) from public,anon;
grant execute on function public.get_reconciliation_staff() to authenticated;
grant execute on function public.get_reconciliation_report(date,date,text,text,uuid) to authenticated;
grant execute on function public.checkout_appointment(bigint,text,jsonb,jsonb,text,bigint) to authenticated;

commit;
