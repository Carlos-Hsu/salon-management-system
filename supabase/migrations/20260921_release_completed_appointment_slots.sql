-- Completed appointments remain in history but no longer reserve calendar capacity.
begin;

alter table public.appointments
  drop constraint if exists appointments_no_active_overlap;

alter table public.appointments
  add constraint appointments_no_active_overlap
  exclude using gist (tstzrange(start_time,end_time,'[)') with &&)
  where (status not in ('completed','cancelled') and deleted_at is null);

create or replace function public.validate_calendar_slot()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  perform pg_advisory_xact_lock(8127331);
  if tg_table_name = 'appointments' then
    if new.status not in ('completed','cancelled') and exists (
      select 1 from public.blocked_times b
      where new.start_time < b.end_time and new.end_time > b.start_time
    ) then
      raise exception using errcode='23P01',message='Appointment overlaps blocked time';
    end if;
  elsif tg_table_name = 'blocked_times' then
    if exists (
      select 1 from public.appointments a
      where a.status not in ('completed','cancelled')
        and a.deleted_at is null
        and new.start_time < a.end_time
        and new.end_time > a.start_time
    ) then
      raise exception using errcode='23P01',message='Blocked time overlaps appointment';
    end if;
  end if;
  return new;
end
$$;

commit;
