begin;

alter table public.profiles
  add column if not exists full_name text;

update public.profiles as profile
set
  full_name = '經營者',
  updated_at = now()
from auth.users as auth_user
where profile.id = auth_user.id
  and lower(auth_user.email) = lower('berb57606072@gmail.com');

-- The existing profiles RLS policy still restricts updates to super_admin.
grant update (full_name, updated_at)
on table public.profiles
to authenticated;

commit;

select
  auth_user.email,
  profile.full_name,
  profile.role
from auth.users as auth_user
join public.profiles as profile
  on profile.id = auth_user.id
where lower(auth_user.email) = lower('berb57606072@gmail.com');
