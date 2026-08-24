-- Add profile display names without embedding an environment-specific admin email.
begin;

alter table public.profiles
  add column if not exists full_name text;

-- Prefer Auth metadata; use the email local-part only as a display fallback.
update public.profiles as profile
set
  full_name=coalesce(
    nullif(btrim(auth_user.raw_user_meta_data->>'full_name'),''),
    nullif(split_part(coalesce(auth_user.email,''),'@',1),'')
  ),
  updated_at=now()
from auth.users as auth_user
where profile.id=auth_user.id
  and profile.full_name is null;

-- RLS still limits profile changes; role assignment is handled by the
-- authenticated-core migration rather than a hard-coded email address.
grant update(full_name,updated_at) on table public.profiles to authenticated;

commit;
