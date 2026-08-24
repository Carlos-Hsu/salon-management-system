-- Run after 20260827_authenticated_core_rls.sql in the target Supabase project.
do $$
declare table_name text; rpc_signature text;
begin
  foreach table_name in array array[
    'customers','services','products','appointments','blocked_times',
    'orders','order_items','stock_adjustments','finance_records'
  ] loop
    if exists(
      select 1 from pg_policies
      where schemaname='public' and tablename=table_name
        and ('anon'=any(roles) or policyname='dev_anon_all')
    ) then
      raise exception 'Anonymous policy remains on public.%',table_name;
    end if;
    if has_table_privilege('anon',format('public.%I',table_name),'SELECT')
       or has_table_privilege('anon',format('public.%I',table_name),'INSERT')
       or has_table_privilege('anon',format('public.%I',table_name),'UPDATE')
       or has_table_privilege('anon',format('public.%I',table_name),'DELETE') then
      raise exception 'Anonymous table privilege remains on public.%',table_name;
    end if;
  end loop;

  foreach rpc_signature in array array[
    'public.create_appointment(bigint,bigint,timestamp with time zone,text,jsonb,text)',
    'public.update_appointment(bigint,bigint,bigint,timestamp with time zone,text,jsonb,text)',
    'public.adjust_product_stock(bigint,integer,text)',
    'public.update_product(bigint,text,bigint,integer,text,boolean)',
    'public.checkout_appointment(bigint,text,jsonb,jsonb,text,bigint)'
  ] loop
    if has_function_privilege('anon',rpc_signature,'EXECUTE') then
      raise exception 'Anonymous RPC execution privilege remains on %',rpc_signature;
    end if;
    if not has_function_privilege('authenticated',rpc_signature,'EXECUTE') then
      raise exception 'Authenticated RPC execution privilege missing on %',rpc_signature;
    end if;
  end loop;

  foreach table_name in array array[
    'customers','products','appointments','blocked_times',
    'orders','order_items','stock_adjustments','finance_records'
  ] loop
    if not has_table_privilege('authenticated',format('public.%I',table_name),'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'Authenticated CRUD grant missing on public.%',table_name;
    end if;
    if not exists(
      select 1 from pg_policies
      where schemaname='public' and tablename=table_name
        and 'authenticated'=any(roles) and cmd='ALL'
    ) then
      raise exception 'Authenticated RLS policy missing on public.%',table_name;
    end if;
  end loop;

  if not exists(select 1 from public.profiles where role='super_admin') then
    raise exception 'No super_admin profile is assigned';
  end if;
end $$;
