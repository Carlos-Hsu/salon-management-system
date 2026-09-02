-- Customer IDs are bigint in this project, not UUID.
-- A PL/pgSQL function runs atomically: an exception rolls back every delete.
begin;

create or replace function public.permanently_delete_customer(p_customer_id bigint)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authenticated user required';
  end if;
  if not exists (select 1 from public.customers where id = p_customer_id) then
    raise exception using errcode = 'P0002', message = 'Customer not found';
  end if;

  delete from public.finance_records
  where appointment_id in (select id from public.appointments where customer_id = p_customer_id)
     or order_id in (select id from public.orders where appointment_id in (select id from public.appointments where customer_id = p_customer_id));
  delete from public.stock_adjustments
  where order_id in (select id from public.orders where appointment_id in (select id from public.appointments where customer_id = p_customer_id));
  delete from public.order_items
  where order_id in (select id from public.orders where appointment_id in (select id from public.appointments where customer_id = p_customer_id));
  delete from public.orders
  where appointment_id in (select id from public.appointments where customer_id = p_customer_id);
  delete from public.appointments where customer_id = p_customer_id;
  delete from public.customers where id = p_customer_id;
  return p_customer_id;
end;
$$;

revoke execute on function public.permanently_delete_customer(bigint) from public, anon;
grant execute on function public.permanently_delete_customer(bigint) to authenticated;

commit;
