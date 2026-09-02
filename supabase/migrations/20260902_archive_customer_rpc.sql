-- Apply this migration in the production Supabase project before deploying the
-- frontend that calls archive_customer. It is safe to run more than once.
begin;

alter table public.customers
  add column if not exists deleted_at timestamptz;

create index if not exists customers_active_name_idx
  on public.customers (name)
  where deleted_at is null;

alter table public.customers enable row level security;
grant select, insert, update on public.customers to authenticated;

-- This explicit policy also supports projects that predate authenticated_access.
drop policy if exists customers_authenticated_update on public.customers;
create policy customers_authenticated_update on public.customers
  for update to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

create or replace function public.archive_customer(p_customer_id bigint)
returns bigint
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare v_customer_id bigint;
begin
  update public.customers
  set deleted_at = coalesce(deleted_at, now())
  where id = p_customer_id and deleted_at is null
  returning id into v_customer_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Customer not found or already deleted';
  end if;
  return v_customer_id;
end;
$$;

revoke execute on function public.archive_customer(bigint) from public, anon;
grant execute on function public.archive_customer(bigint) to authenticated;

commit;
