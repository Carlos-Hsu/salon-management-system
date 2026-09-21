alter table public.appointments alter column service_id drop not null;
alter table public.appointments add column if not exists custom_service_name text;
alter table public.appointments add column if not exists custom_service_duration integer check (custom_service_duration > 0);
alter table public.appointments add column if not exists custom_service_price bigint check (custom_service_price >= 0);
alter table public.appointments drop constraint if exists appointments_service_source_check;
alter table public.appointments add constraint appointments_service_source_check check (
  (service_id is not null and custom_service_name is null and custom_service_duration is null and custom_service_price is null)
  or (service_id is null and btrim(coalesce(custom_service_name,'')) <> '' and custom_service_duration > 0 and custom_service_price >= 0)
);

drop function if exists public.create_appointment(bigint,bigint,timestamptz,text,jsonb,text);
create function public.create_appointment(p_customer_id bigint,p_service_id bigint,p_start_time timestamptz,p_status text default 'pending',p_custom_items jsonb default '[]',p_note text default null,p_custom_service_name text default null,p_custom_service_duration integer default null,p_custom_service_price bigint default null)
returns public.appointments language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_duration integer; v_price bigint; v_result public.appointments;
begin
  if p_status <> 'pending' then raise exception 'New appointments must start pending'; end if;
  if p_service_id is null then
    if btrim(coalesce(p_custom_service_name,''))='' or p_custom_service_duration is null or p_custom_service_duration<1 or p_custom_service_price is null or p_custom_service_price<0 then raise exception 'Invalid custom service'; end if;
    v_duration:=p_custom_service_duration; v_price:=p_custom_service_price;
  else select duration_min,price into strict v_duration,v_price from public.services where id=p_service_id and active and deleted_at is null; end if;
  insert into public.appointments(customer_id,service_id,custom_service_name,custom_service_duration,custom_service_price,start_time,end_time,status,total_amount,custom_items,note)
  values(p_customer_id,p_service_id,case when p_service_id is null then btrim(p_custom_service_name) end,case when p_service_id is null then v_duration end,case when p_service_id is null then v_price end,p_start_time,p_start_time+make_interval(mins=>v_duration),'pending',v_price,coalesce(p_custom_items,'[]'),p_note) returning * into v_result;
  return v_result;
end $$;

drop function if exists public.update_appointment(bigint,bigint,bigint,timestamptz,text,jsonb,text);
create function public.update_appointment(p_id bigint,p_customer_id bigint,p_service_id bigint,p_start_time timestamptz,p_status text,p_custom_items jsonb default '[]',p_note text default null,p_custom_service_name text default null,p_custom_service_duration integer default null,p_custom_service_price bigint default null)
returns public.appointments language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_duration integer; v_result public.appointments;
begin
  if p_service_id is null then
    if btrim(coalesce(p_custom_service_name,''))='' or p_custom_service_duration is null or p_custom_service_duration<1 or p_custom_service_price is null or p_custom_service_price<0 then raise exception 'Invalid custom service'; end if;
    v_duration:=p_custom_service_duration;
  else select duration_min into strict v_duration from public.services where id=p_service_id; end if;
  update public.appointments set customer_id=p_customer_id,service_id=p_service_id,custom_service_name=case when p_service_id is null then btrim(p_custom_service_name) end,custom_service_duration=case when p_service_id is null then p_custom_service_duration end,custom_service_price=case when p_service_id is null then p_custom_service_price end,start_time=p_start_time,end_time=p_start_time+make_interval(mins=>v_duration),status=p_status::public.appointment_status,custom_items=coalesce(p_custom_items,'[]'),note=p_note where id=p_id returning * into strict v_result;
  return v_result;
end $$;

create or replace function public.checkout_appointment(p_appointment_id bigint,p_idempotency_key text,p_product_items jsonb default '[]',p_custom_items jsonb default '[]',p_payment_method text default 'cash',p_discount bigint default 0)
returns table(order_id bigint,total_amount bigint) language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_app public.appointments; v_order public.orders; v_service_name text; v_service_amount bigint; v_product_amount bigint:=0; v_custom_amount bigint:=0; v_item jsonb; v_product public.products; v_qty integer; v_total bigint;
begin
  select * into strict v_app from public.appointments where id=p_appointment_id for update;
  select * into v_order from public.orders where idempotency_key=p_idempotency_key;
  if found then if v_order.appointment_id<>p_appointment_id then raise exception 'Idempotency key already used'; end if; return query select v_order.id,v_order.total_amount; return; end if;
  if exists(select 1 from public.orders where appointment_id=p_appointment_id) then raise exception 'Appointment was already checked out with another idempotency key'; end if;
  if v_app.status<>'in_service' then raise exception 'Only in-service appointments can be checked out'; end if;
  if v_app.service_id is null then v_service_name:=v_app.custom_service_name; v_service_amount:=v_app.custom_service_price;
  else select name,price into strict v_service_name,v_service_amount from public.services where id=v_app.service_id; end if;
  if jsonb_typeof(coalesce(p_product_items,'[]'))<>'array' or jsonb_typeof(coalesce(p_custom_items,'[]'))<>'array' or p_discount<0 or p_payment_method not in ('cash','credit_card','line_pay','bank_transfer') then raise exception 'Invalid checkout items, discount, or payment method'; end if;
  for v_item in select value from jsonb_array_elements(coalesce(p_product_items,'[]')) loop
    v_qty=(v_item->>'quantity')::integer; if v_qty<=0 then raise exception 'Product quantity must be positive'; end if;
    select * into strict v_product from public.products where id=(v_item->>'product_id')::bigint for update;
    if not v_product.active or v_product.stock<v_qty then raise exception 'Product unavailable or insufficient stock'; end if;
    v_product_amount:=v_product_amount+(v_product.price*v_qty);
  end loop;
  for v_item in select value from jsonb_array_elements(coalesce(p_custom_items,'[]')) loop
    if btrim(coalesce(v_item->>'name',''))='' or (v_item->>'amount')::bigint<0 then raise exception 'Invalid custom item'; end if; v_custom_amount:=v_custom_amount+(v_item->>'amount')::bigint;
  end loop;
  v_total:=greatest(0,v_service_amount+v_product_amount+v_custom_amount-p_discount);
  insert into public.orders(appointment_id,idempotency_key,service_amount,product_amount,custom_amount,discount,total_amount,payment_method,custom_items,handled_by) values(p_appointment_id,p_idempotency_key,v_service_amount,v_product_amount,v_custom_amount,p_discount,v_total,p_payment_method,coalesce(p_custom_items,'[]'),auth.uid()) returning * into v_order;
  insert into public.order_items(order_id,item_type,name,quantity,unit_amount,line_amount) values(v_order.id,'service',v_service_name,1,v_service_amount,v_service_amount);
  for v_item in select value from jsonb_array_elements(coalesce(p_product_items,'[]')) loop
    v_qty=(v_item->>'quantity')::integer; select * into strict v_product from public.products where id=(v_item->>'product_id')::bigint for update;
    update public.products set stock=stock-v_qty where id=v_product.id and active and stock>=v_qty returning stock into v_product.stock;
    if not found then raise exception 'Product unavailable or insufficient stock'; end if;
    insert into public.order_items(order_id,item_type,product_id,name,quantity,unit_amount,line_amount) values(v_order.id,'product',v_product.id,v_product.name,v_qty,v_product.price,v_product.price*v_qty);
    insert into public.stock_adjustments(product_id,order_id,quantity_delta,resulting_stock,reason) values(v_product.id,v_order.id,-v_qty,v_product.stock,'Checkout');
  end loop;
  for v_item in select value from jsonb_array_elements(coalesce(p_custom_items,'[]')) loop insert into public.order_items(order_id,item_type,name,quantity,unit_amount,line_amount) values(v_order.id,'custom',v_item->>'name',1,(v_item->>'amount')::bigint,(v_item->>'amount')::bigint); end loop;
  perform set_config('app.checkout_appointment_id',p_appointment_id::text,true);
  update public.appointments set status='completed',total_amount=v_total,custom_items=coalesce(p_custom_items,'[]') where id=p_appointment_id;
  return query select v_order.id,v_order.total_amount;
end $$;

revoke execute on function public.create_appointment(bigint,bigint,timestamptz,text,jsonb,text,text,integer,bigint), public.update_appointment(bigint,bigint,bigint,timestamptz,text,jsonb,text,text,integer,bigint) from public,anon;
grant execute on function public.create_appointment(bigint,bigint,timestamptz,text,jsonb,text,text,integer,bigint), public.update_appointment(bigint,bigint,bigint,timestamptz,text,jsonb,text,text,integer,bigint) to authenticated;
