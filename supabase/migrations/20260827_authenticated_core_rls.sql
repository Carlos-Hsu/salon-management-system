-- Replace development anonymous access with authenticated operational access.
-- Super admins retain exclusive control of services, settings, and profile roles.
begin;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_role text;
begin
  perform pg_advisory_xact_lock(8127332);
  v_role:=case when exists(select 1 from public.profiles where role='super_admin') then 'staff' else 'super_admin' end;
  insert into public.profiles(id,email,full_name,role)
  values(new.id,new.email,nullif(btrim(coalesce(new.raw_user_meta_data->>'full_name','')),''),v_role)
  on conflict(id) do update set email=excluded.email,full_name=coalesce(public.profiles.full_name,excluded.full_name),updated_at=now();
  return new;
end $$;

-- Existing installations may predate automatic bootstrap. Promote only the
-- oldest existing user when no super admin has ever been assigned.
with first_user as (
  select id from auth.users order by created_at,id limit 1
)
update public.profiles
set role='super_admin',updated_at=now()
where id=(select id from first_user)
  and not exists(select 1 from public.profiles where role='super_admin');

-- Authenticated table grants must not permit bypassing the appointment lifecycle.
create or replace function public.validate_appointment_transition()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  if tg_op='INSERT' then
    if new.status<>'pending' then raise exception using errcode='23514',message='New appointments must start pending'; end if;
    return new;
  end if;
  if old.status in ('completed','cancelled') then raise exception using errcode='23514',message='Terminal appointments cannot be modified'; end if;
  if old.status=new.status then return new; end if;
  if not ((old.status='pending' and new.status in ('confirmed','cancelled')) or (old.status='confirmed' and new.status in ('in_service','cancelled')) or (old.status='in_service' and new.status='cancelled') or (old.status='in_service' and new.status='completed' and current_setting('app.checkout_appointment_id',true)=new.id::text)) then
    raise exception using errcode='23514',message='Invalid appointment state transition; completion requires checkout';
  end if;
  return new;
end $$;
drop trigger if exists appointment_state_guard on public.appointments;
create trigger appointment_state_guard before insert or update on public.appointments
for each row execute function public.validate_appointment_transition();

-- Remove every development policy, including supporting immutable ledgers.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'customers','services','products','appointments','blocked_times',
    'orders','order_items','stock_adjustments','finance_records'
  ] loop
    execute format('drop policy if exists dev_anon_all on public.%I',table_name);
  end loop;
end $$;

revoke all on public.customers,public.services,public.products,public.appointments,
  public.blocked_times,public.orders,public.order_items,public.stock_adjustments,
  public.finance_records,public.system_settings from anon;
revoke usage,select on all sequences in schema public from anon;
revoke execute on function public.create_appointment(bigint,bigint,timestamptz,text,jsonb,text),
  public.update_appointment(bigint,bigint,bigint,timestamptz,text,jsonb,text),
  public.adjust_product_stock(bigint,integer,text),
  public.update_product(bigint,text,bigint,integer,text,boolean),
  public.checkout_appointment(bigint,text,jsonb,jsonb,text,bigint) from anon;

-- Authenticated salon operators can manage daily operational records. Database
-- triggers and constraints continue to enforce overlap, lifecycle, and checkout.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'customers','products','appointments','blocked_times',
    'orders','order_items','stock_adjustments','finance_records'
  ] loop
    execute format('drop policy if exists authenticated_access on public.%I',table_name);
    execute format(
      'create policy authenticated_access on public.%I for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null)',
      table_name
    );
  end loop;
end $$;

grant select,insert,update,delete on public.customers,public.products,
  public.appointments,public.blocked_times,public.orders,public.order_items,
  public.stock_adjustments,public.finance_records to authenticated;
grant usage,select on all sequences in schema public to authenticated;
grant execute on function public.create_appointment(bigint,bigint,timestamptz,text,jsonb,text),
  public.update_appointment(bigint,bigint,bigint,timestamptz,text,jsonb,text),
  public.adjust_product_stock(bigint,integer,text),
  public.update_product(bigint,text,bigint,integer,text,boolean),
  public.checkout_appointment(bigint,text,jsonb,jsonb,text,bigint) to authenticated;

-- Services and system configuration are readable after login but mutable only
-- by super_admin through their dedicated policies from the prior migration.
drop policy if exists services_read on public.services;
create policy services_read on public.services for select to authenticated
using (auth.uid() is not null);
drop policy if exists system_settings_read on public.system_settings;
create policy system_settings_read on public.system_settings for select to authenticated
using (auth.uid() is not null);
grant select on public.services,public.system_settings to authenticated;

commit;
