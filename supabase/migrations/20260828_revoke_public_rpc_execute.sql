-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Revoking only
-- from anon is insufficient because anon inherits privileges granted to PUBLIC.
begin;

revoke execute on function
  public.create_appointment(bigint,bigint,timestamptz,text,jsonb,text),
  public.update_appointment(bigint,bigint,bigint,timestamptz,text,jsonb,text),
  public.adjust_product_stock(bigint,integer,text),
  public.update_product(bigint,text,bigint,integer,text,boolean),
  public.checkout_appointment(bigint,text,jsonb,jsonb,text,bigint)
from public, anon;

grant execute on function
  public.create_appointment(bigint,bigint,timestamptz,text,jsonb,text),
  public.update_appointment(bigint,bigint,bigint,timestamptz,text,jsonb,text),
  public.adjust_product_stock(bigint,integer,text),
  public.update_product(bigint,text,bigint,integer,text,boolean),
  public.checkout_appointment(bigint,text,jsonb,jsonb,text,bigint)
to authenticated;

commit;
