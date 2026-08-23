-- Enrich July 2026 demo finance data for a solo salon. Safe to rerun.
begin;

-- The closeout workflow uses only cash and LINE Pay.
update public.orders o
set payment_method = case mod(o.id,2) when 0 then 'cash' else 'line_pay' end
from public.appointments a
where a.id=o.appointment_id
  and a.note like 'DEMO_JULY_2026_%'
  and a.start_time >= timestamptz '2026-07-01 00:00:00+08'
  and a.start_time < timestamptz '2026-08-01 00:00:00+08';

update public.finance_records f
set notes=case o.payment_method when 'cash' then '現金' else 'LINE Pay' end,updated_at=now()
from public.orders o,public.appointments a
where f.order_id=o.id and a.id=o.appointment_id
  and a.note like 'DEMO_JULY_2026_%'
  and a.start_time >= timestamptz '2026-07-01 00:00:00+08'
  and a.start_time < timestamptz '2026-08-01 00:00:00+08';

delete from public.finance_records
where type='expense' and notes like '[DEMO_JULY_2026_EXPENSE]%';

insert into public.finance_records(type,category,amount,occurred_at,notes,source)
values
  ('expense','店面房租',20000,timestamptz '2026-07-05 12:00:00+08','[DEMO_JULY_2026_EXPENSE] 7 月店面房租','manual'),
  ('expense','水電電費',3800,timestamptz '2026-07-12 12:00:00+08','[DEMO_JULY_2026_EXPENSE] 7 月水電電費','manual'),
  ('expense','髮品藥水進貨',11200,timestamptz '2026-07-18 12:00:00+08','[DEMO_JULY_2026_EXPENSE] 染膏、燙髮藥水與護髮耗材','manual');

commit;
