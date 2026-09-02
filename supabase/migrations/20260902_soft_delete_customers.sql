-- Preserve customer records referenced by appointments, orders, and finance history.
-- The frontend filters deleted rows from the CRM list.
begin;

alter table public.customers
  add column if not exists deleted_at timestamptz;

create index if not exists customers_active_name_idx
  on public.customers (name)
  where deleted_at is null;

commit;
