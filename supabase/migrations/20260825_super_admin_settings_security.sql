-- Super-admin authorization and protected system settings.
-- Apply in Supabase SQL Editor before enabling the frontend gate.
begin;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'staff' check (role in ('staff', 'super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists role text not null default 'staff';
do $$ begin
  alter table public.profiles add constraint profiles_role_check check (role in ('staff', 'super_admin'));
exception when duplicate_object then null;
end $$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'staff')
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end
$$;

drop trigger if exists auth_user_profile_created on auth.users;
create trigger auth_user_profile_created
after insert or update of email on auth.users
for each row execute function public.handle_new_user_profile();

insert into public.profiles (id, email, role)
select id, email, 'staff' from auth.users
on conflict (id) do update set email = excluded.email, updated_at = now();

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  );
$$;

revoke all on function public.is_super_admin() from public;
grant execute on function public.is_super_admin() to authenticated;

create table if not exists public.system_settings (
  key text primary key check (btrim(key) <> ''),
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.system_settings (key, value, description) values
  ('store_name', to_jsonb('我的美髮工作室'::text), '店家顯示名稱'),
  ('opening_time', to_jsonb('10:00'::text), '每日開始營業時間'),
  ('closing_time', to_jsonb('20:00'::text), '每日結束營業時間'),
  ('default_payment', to_jsonb('cash'::text), '預設付款方式：cash 或 line_pay'),
  ('holiday_surcharge_type', to_jsonb('none'::text), '假日加價方式：none、percent 或 fixed'),
  ('holiday_surcharge_value', to_jsonb(0), '假日加價比例或固定金額'),
  ('reminder_enabled', to_jsonb(true), '是否啟用預約提醒'),
  ('reminder_hours', to_jsonb(24), '預約前提醒小時數'),
  ('auto_backup', to_jsonb(false), '自動備份偏好')
on conflict (key) do nothing;

alter table public.profiles enable row level security;
alter table public.system_settings enable row level security;
alter table public.services enable row level security;

-- Remove the development policy that previously allowed anonymous service writes.
drop policy if exists dev_anon_all on public.services;

drop policy if exists profiles_read_own_or_admin on public.profiles;
create policy profiles_read_own_or_admin on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_super_admin());

drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists system_settings_read on public.system_settings;
create policy system_settings_read on public.system_settings
for select to anon, authenticated using (true);

drop policy if exists system_settings_admin_insert on public.system_settings;
create policy system_settings_admin_insert on public.system_settings
for insert to authenticated with check (public.is_super_admin());

drop policy if exists system_settings_admin_update on public.system_settings;
create policy system_settings_admin_update on public.system_settings
for update to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists system_settings_admin_delete on public.system_settings;
create policy system_settings_admin_delete on public.system_settings
for delete to authenticated using (public.is_super_admin());

drop policy if exists services_read on public.services;
create policy services_read on public.services
for select to anon, authenticated using (true);

drop policy if exists services_admin_insert on public.services;
create policy services_admin_insert on public.services
for insert to authenticated with check (public.is_super_admin());

drop policy if exists services_admin_update on public.services;
create policy services_admin_update on public.services
for update to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

drop policy if exists services_admin_delete on public.services;
create policy services_admin_delete on public.services
for delete to authenticated using (public.is_super_admin());

revoke insert, update, delete on public.services from anon;
revoke insert, update, delete on public.system_settings from anon;
grant select on public.services, public.system_settings to anon, authenticated;
grant insert, update, delete on public.services, public.system_settings to authenticated;
grant select on public.profiles to authenticated;
grant update (email, role, updated_at) on public.profiles to authenticated;

commit;
