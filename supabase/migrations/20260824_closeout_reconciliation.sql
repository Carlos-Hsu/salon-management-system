-- Normalize checkout channels for the solo-studio closeout workflow.
begin;

update public.orders set payment_method='line_pay'
where payment_method not in ('cash','line_pay');

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
check (payment_method in ('cash','line_pay'));

create or replace function public.sync_completed_appointment_income()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare v_order_id bigint; v_amount bigint; v_payment_method text; v_notes text;
begin
  if new.status <> 'completed' then return new; end if;
  select o.id,o.total_amount,o.payment_method into v_order_id,v_amount,v_payment_method
  from public.orders o where o.appointment_id=new.id;
  v_amount:=coalesce(v_amount,new.total_amount);
  v_notes:=case when v_payment_method='cash' then '現金' when v_payment_method is null then '預約完成自動入帳' else 'LINE Pay' end;
  insert into public.finance_records(type,category,amount,occurred_at,notes,source,appointment_id,order_id)
  values ('income','服務／產品銷售',v_amount,new.start_time,v_notes,case when v_order_id is null then 'appointment' else 'order' end,new.id,v_order_id)
  on conflict (appointment_id) do update set amount=excluded.amount,occurred_at=excluded.occurred_at,notes=excluded.notes,order_id=coalesce(excluded.order_id,public.finance_records.order_id),source=excluded.source,updated_at=now();
  return new;
end $$;

create or replace function public.sync_order_income()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
declare v_start_time timestamptz; v_notes text;
begin
  select start_time into strict v_start_time from public.appointments where id=new.appointment_id;
  v_notes:=case new.payment_method when 'cash' then '現金' else 'LINE Pay' end;
  insert into public.finance_records(type,category,amount,occurred_at,notes,source,appointment_id,order_id)
  values ('income','服務／產品銷售',new.total_amount,v_start_time,v_notes,'order',new.appointment_id,new.id)
  on conflict (appointment_id) do update set amount=excluded.amount,occurred_at=excluded.occurred_at,notes=excluded.notes,order_id=excluded.order_id,source='order',updated_at=now();
  return new;
end $$;

drop trigger if exists orders_sync_income on public.orders;
create trigger orders_sync_income after insert or update of total_amount,payment_method on public.orders
for each row execute function public.sync_order_income();

update public.finance_records f
set notes=case o.payment_method when 'cash' then '現金' else 'LINE Pay' end,updated_at=now()
from public.orders o where f.order_id=o.id;

commit;
