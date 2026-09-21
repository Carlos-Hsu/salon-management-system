alter table public.services
  add column if not exists deleted_at timestamptz;

create index if not exists services_deleted_at_idx
  on public.services (deleted_at);

create or replace function public.create_appointment(
  p_customer_id bigint,
  p_service_id bigint,
  p_start_time timestamptz,
  p_status text default 'pending',
  p_custom_items jsonb default '[]',
  p_note text default null
) returns public.appointments language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_duration integer; v_price bigint; v_result public.appointments;
begin
  if p_status <> 'pending' then raise exception 'New appointments must start pending'; end if;
  select duration_min,price into strict v_duration,v_price
    from public.services where id=p_service_id and active and deleted_at is null;
  insert into public.appointments(customer_id,service_id,start_time,end_time,status,total_amount,custom_items,note)
  values(p_customer_id,p_service_id,p_start_time,p_start_time+make_interval(mins=>v_duration),'pending',v_price,coalesce(p_custom_items,'[]'),p_note)
  returning * into v_result;
  return v_result;
end $$;
