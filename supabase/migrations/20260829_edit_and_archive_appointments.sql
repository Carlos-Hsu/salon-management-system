-- Allow terminal appointments to be corrected without changing lifecycle status.
-- "Delete" is an archive operation so completed checkout/finance/stock history remains auditable.
begin;

alter table public.appointments
  add column if not exists deleted_at timestamptz;

create index if not exists appointments_active_idx
  on public.appointments(start_time)
  where deleted_at is null;

-- Archived appointments no longer reserve calendar capacity.
alter table public.appointments
  drop constraint if exists appointments_no_active_overlap;
alter table public.appointments
  add constraint appointments_no_active_overlap
  exclude using gist (tstzrange(start_time,end_time,'[)') with &&)
  where (status <> 'cancelled' and deleted_at is null);

create or replace function public.validate_calendar_slot()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  perform pg_advisory_xact_lock(8127331);
  if tg_table_name = 'appointments' then
    if new.status <> 'cancelled' and exists (
      select 1 from public.blocked_times b
      where new.start_time < b.end_time and new.end_time > b.start_time
    ) then
      raise exception using errcode='23P01',message='Appointment overlaps blocked time';
    end if;
  elsif tg_table_name = 'blocked_times' then
    if exists (
      select 1 from public.appointments a
      where a.status <> 'cancelled'
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

create or replace function public.validate_appointment_transition()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if tg_op='INSERT' then
    if new.status <> 'pending' then
      raise exception using errcode='23514',message='New appointments must start pending';
    end if;
    return new;
  end if;

  -- Any appointment may be corrected while its lifecycle status is unchanged.
  if old.status = new.status then return new; end if;

  -- Completed/cancelled records remain terminal to protect checkout history.
  if old.status in ('completed','cancelled') then
    raise exception using errcode='23514',message='Terminal appointment status cannot be changed';
  end if;

  if not (
    (old.status='pending' and new.status in ('confirmed','cancelled'))
    or (old.status='confirmed' and new.status in ('in_service','cancelled'))
    or (old.status='in_service' and new.status='cancelled')
    or (
      old.status='in_service'
      and new.status='completed'
      and current_setting('app.checkout_appointment_id',true)=new.id::text
    )
  ) then
    raise exception using errcode='23514',message='Invalid appointment state transition; completion requires checkout';
  end if;
  return new;
end
$$;

-- Rescheduling a completed appointment also keeps its finance occurrence date in sync.
drop trigger if exists appointments_sync_income on public.appointments;
create trigger appointments_sync_income
after insert or update of status,total_amount,start_time on public.appointments
for each row when (new.status = 'completed')
execute function public.sync_completed_appointment_income();

commit;
