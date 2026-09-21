-- Restore the product mutation RPCs on databases that were built only from
-- migrations. Products that were sold remain protected so historical order
-- lines keep their foreign-key integrity.
begin;

create or replace function public.update_product(
  p_product_id bigint,
  p_name text,
  p_price bigint,
  p_stock integer,
  p_vendor text default null,
  p_active boolean default true
)
returns integer
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_previous integer;
  v_delta integer;
begin
  if btrim(coalesce(p_name, '')) = '' or p_price < 0 or p_stock < 0 then
    raise exception 'Invalid product values';
  end if;

  select stock
  into strict v_previous
  from public.products
  where id = p_product_id
  for update;

  update public.products
  set name = btrim(p_name),
      price = p_price,
      stock = p_stock,
      vendor = nullif(btrim(coalesce(p_vendor, '')), ''),
      active = p_active
  where id = p_product_id;

  v_delta := p_stock - v_previous;
  if v_delta <> 0 then
    insert into public.stock_adjustments(
      product_id,
      quantity_delta,
      resulting_stock,
      reason
    )
    values (p_product_id, v_delta, p_stock, 'Inline stock edit');
  end if;

  return p_stock;
exception
  when no_data_found then
    raise exception using errcode = 'P0002', message = 'Product not found';
end;
$$;

create or replace function public.delete_product(p_product_id bigint)
returns bigint
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  perform 1
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Product not found';
  end if;

  if exists (
    select 1
    from public.order_items
    where product_id = p_product_id
  ) then
    raise exception using
      errcode = '23503',
      message = '此產品已有訂單紀錄，請改為停用以保留歷史資料。';
  end if;

  delete from public.stock_adjustments where product_id = p_product_id;
  delete from public.products where id = p_product_id;
  return p_product_id;
end;
$$;

revoke execute on function public.update_product(bigint,text,bigint,integer,text,boolean)
from public, anon;
revoke execute on function public.delete_product(bigint)
from public, anon;

grant execute on function public.update_product(bigint,text,bigint,integer,text,boolean)
to authenticated;
grant execute on function public.delete_product(bigint)
to authenticated;

commit;
