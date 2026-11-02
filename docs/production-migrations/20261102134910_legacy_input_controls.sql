-- Reviewed input validation and quotas only; preserves legacy checkout/pricing/fulfillment bodies and existing RPC ACLs.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $guard$ begin
if current_user <> 'postgres' then raise exception 'Apply as postgres'; end if;
if to_regprocedure('private.customer_rate_limit(text,integer,integer)') is null then raise exception 'Quota migration required'; end if;
if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='assert_object_fields') then raise exception 'Unexpected function: assert_object_fields'; end if;
if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_save_product' and md5(prosrc)='373edd772ae9ba27da05051d9ac7abc1' and pg_get_userbyid(proowner)='postgres') then raise exception 'Unreviewed baseline: admin_save_product'; end if;
if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='customer_save_address' and md5(prosrc)='3e5d4999d3b084286e834f69ee5b5243' and pg_get_userbyid(proowner)='postgres') then raise exception 'Unreviewed baseline: customer_save_address'; end if;
if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_save_promo' and md5(prosrc)='7ef70b3da648bcf8703a3e51be1f88ab' and pg_get_userbyid(proowner)='postgres') then raise exception 'Unreviewed baseline: admin_save_promo'; end if;
if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='checkout_quote_promo' and md5(prosrc)='646318d84b0543ad034eab84842320c0' and pg_get_userbyid(proowner)='postgres') then raise exception 'Unreviewed baseline: checkout_quote_promo'; end if;
if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='customer_create_return_request' and md5(prosrc)='9888a572192f2ff46a0984adda2e51a7' and pg_get_userbyid(proowner)='postgres') then raise exception 'Unreviewed baseline: customer_create_return_request'; end if;
end $guard$;
CREATE OR REPLACE FUNCTION private.assert_object_fields(p_value jsonb, p_fields text[])
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
begin
  if jsonb_typeof(p_value) is distinct from 'object' then raise exception 'Invalid object' using errcode='22023'; end if;
  if octet_length(p_value::text)>65536 or exists(select 1 from jsonb_each(p_value) e where not(e.key=any(p_fields)) or jsonb_typeof(e.value) in ('object','array')) then
    raise exception 'Unexpected object fields' using errcode='22023';
  end if;
end $function$
;
revoke all on function private.assert_object_fields(p_value jsonb, p_fields text[]) from public,anon,authenticated;
grant execute on function private.assert_object_fields(p_value jsonb, p_fields text[]) to authenticated;
CREATE OR REPLACE FUNCTION public.admin_save_product(p_id uuid, p_expected_updated_at timestamp with time zone, p_product jsonb, p_collection_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result_id uuid;
begin
perform private.assert_object_fields(p_product,array['name','slug','description','price','compare_at_price','status','featured','is_drop','category_id','seo_title','seo_description']);
if not private.is_admin() then raise exception 'Forbidden' using errcode='42501'; end if;
if jsonb_typeof(p_product)<>'object' or p_collection_ids is null or cardinality(p_collection_ids)>100 then raise exception 'Invalid input' using errcode='22023'; end if;
if p_id is null then
insert into public.products(name,slug,description,price,compare_at_price,status,featured,is_drop,category_id,seo_title,seo_description)
values(p_product->>'name',p_product->>'slug',p_product->>'description',(p_product->>'price')::integer,(p_product->>'compare_at_price')::integer,(p_product->>'status')::public.product_status,(p_product->>'featured')::boolean,(p_product->>'is_drop')::boolean,(p_product->>'category_id')::uuid,p_product->>'seo_title',p_product->>'seo_description') returning id into result_id;
else
update public.products set name=p_product->>'name',slug=p_product->>'slug',description=p_product->>'description',price=(p_product->>'price')::integer,compare_at_price=(p_product->>'compare_at_price')::integer,status=(p_product->>'status')::public.product_status,featured=(p_product->>'featured')::boolean,is_drop=(p_product->>'is_drop')::boolean,category_id=(p_product->>'category_id')::uuid,seo_title=p_product->>'seo_title',seo_description=p_product->>'seo_description' where id=p_id and updated_at=p_expected_updated_at returning id into result_id;
if result_id is null then raise exception 'Record changed or unavailable' using errcode='40001'; end if;
end if;
delete from public.product_collections where product_id=result_id;
insert into public.product_collections(product_id,collection_id) select result_id,x from (select distinct unnest(p_collection_ids) x) s;
return result_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.customer_save_address(p_id uuid, p_address jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare result_id uuid; owner_id uuid := auth.uid();
begin
perform private.assert_object_fields(p_address,array['recipient_name','phone','country_code','city','address_line_1','address_line_2','postal_code','is_default']);
if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
-- Serialize default-address changes for this customer.
perform 1 from public.profiles where id=owner_id for update;
if not found then raise exception 'Profile unavailable' using errcode='42501'; end if;
if (p_address->>'is_default')::boolean then update public.addresses set is_default=false where profile_id=owner_id; end if;
if p_id is null then
insert into public.addresses(recipient_name,phone,country_code,city,address_line_1,address_line_2,postal_code,is_default)
values(p_address->>'recipient_name',p_address->>'phone',p_address->>'country_code',p_address->>'city',p_address->>'address_line_1',p_address->>'address_line_2',p_address->>'postal_code',(p_address->>'is_default')::boolean) returning id into result_id;
else
update public.addresses set recipient_name=p_address->>'recipient_name',phone=p_address->>'phone',country_code=p_address->>'country_code',city=p_address->>'city',address_line_1=p_address->>'address_line_1',address_line_2=p_address->>'address_line_2',postal_code=p_address->>'postal_code',is_default=(p_address->>'is_default')::boolean where id=p_id and profile_id=owner_id returning id into result_id;
if result_id is null then raise exception 'Address unavailable' using errcode='42501'; end if;
end if;
return result_id;
end $function$
;
CREATE OR REPLACE FUNCTION public.admin_save_promo(p_id uuid, p_expected_updated_at timestamp with time zone, p_promo jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
begin
perform private.assert_object_fields(p_promo,array['code','kind','amount','currency','minimum_subtotal','maximum_discount','max_uses','starts_at','expires_at','is_active']);
  if not private.is_admin() then
    raise exception 'Forbidden' using errcode='42501';
  end if;

  if jsonb_typeof(p_promo) <> 'object' then
    raise exception 'Invalid promo input' using errcode='22023';
  end if;

  if p_id is null then
    insert into public.promo_codes(
      code,
      kind,
      amount,
      currency,
      minimum_subtotal,
      maximum_discount,
      starts_at,
      expires_at,
      max_uses,
      is_active
    )
    values(
      upper(trim(p_promo->>'code')),
      (p_promo->>'kind')::public.discount_kind,
      (p_promo->>'amount')::integer,
      p_promo->>'currency',
      (p_promo->>'minimum_subtotal')::integer,
      (p_promo->>'maximum_discount')::integer,
      (p_promo->>'starts_at')::timestamptz,
      (p_promo->>'expires_at')::timestamptz,
      (p_promo->>'max_uses')::integer,
      (p_promo->>'is_active')::boolean
    )
    returning id into v_id;
  else
    update public.promo_codes
    set
      code = upper(trim(p_promo->>'code')),
      kind = (p_promo->>'kind')::public.discount_kind,
      amount = (p_promo->>'amount')::integer,
      currency = p_promo->>'currency',
      minimum_subtotal = (p_promo->>'minimum_subtotal')::integer,
      maximum_discount = (p_promo->>'maximum_discount')::integer,
      starts_at = (p_promo->>'starts_at')::timestamptz,
      expires_at = (p_promo->>'expires_at')::timestamptz,
      max_uses = (p_promo->>'max_uses')::integer,
      is_active = (p_promo->>'is_active')::boolean
    where id = p_id
      and updated_at = p_expected_updated_at
    returning id into v_id;

    if v_id is null then
      raise exception 'Record changed or unavailable' using errcode='40001';
    end if;
  end if;

  return v_id;
end
$function$
;
CREATE OR REPLACE FUNCTION public.checkout_quote_promo(p_code text, p_subtotal integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform private.customer_rate_limit('promo', 60, 3600);
  if p_code is null or length(p_code)>50 or p_subtotal is null or p_subtotal<0 then raise exception 'Invalid promo request' using errcode='22023'; end if;
  return private.resolve_promo(p_code,p_subtotal);
end $function$
;
CREATE OR REPLACE FUNCTION public.customer_create_return_request(p_order_id uuid, p_request_type text, p_reason text, p_details text, p_items jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor_id uuid := (select auth.uid());
  o public.orders%rowtype;
  result_id uuid;
  entry jsonb;
  item_id uuid;
  item_quantity integer;
  ordered_quantity integer;
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  perform private.customer_rate_limit('returns', 20, 3600);
  if p_request_type is null or p_request_type not in ('return','refund') then
    raise exception 'Choose a valid request type' using errcode='22023';
  end if;

  if p_reason is null or p_reason not in ('wrong_size','damaged','not_as_described','changed_mind','duplicate_order','other') then
    raise exception 'Choose a valid reason' using errcode='22023';
  end if;

  if char_length(coalesce(p_details,'')) > 2000 then
    raise exception 'Request details are too long' using errcode='22023';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 50 then
    raise exception 'Choose at least one order item' using errcode='22023';
  end if;

  select * into o
  from public.orders
  where id = p_order_id
  for update;

  if not found or o.customer_id is distinct from actor_id then
    raise exception 'Order unavailable' using errcode='42501';
  end if;

  if o.is_test then
    raise exception 'Test orders cannot create return requests' using errcode='22023';
  end if;

  if o.payment_status not in ('paid','partially_refunded') then
    raise exception 'Payment must be confirmed before a return or refund can be requested' using errcode='22023';
  end if;

  if o.fulfillment_status in ('cancelled','returned') then
    raise exception 'This order is no longer eligible for a return request' using errcode='22023';
  end if;

  if exists (
    select 1
    from public.return_requests
    where order_id = p_order_id
      and status in ('requested','under_review','approved')
  ) then
    raise exception 'An active request already exists for this order' using errcode='23505';
  end if;

  insert into public.return_requests(
    order_id,
    customer_id,
    request_type,
    reason,
    details
  ) values (
    p_order_id,
    actor_id,
    p_request_type,
    p_reason,
    coalesce(p_details,'')
  ) returning id into result_id;

  for entry in select value from jsonb_array_elements(p_items)
  loop
    perform private.assert_object_fields(entry,array['order_item_id','quantity']);
    if jsonb_typeof(entry->'quantity') is distinct from 'number' or (entry->>'quantity') !~ '^[1-9][0-9]{0,6}$' then raise exception 'Invalid return quantity' using errcode='22023'; end if;
    if jsonb_typeof(entry) <> 'object'
       or entry->>'order_item_id' is null
       or entry->>'quantity' is null then
      raise exception 'Invalid return item' using errcode='22023';
    end if;

    begin
      item_id := (entry->>'order_item_id')::uuid;
      item_quantity := (entry->>'quantity')::integer;
    exception when invalid_text_representation then
      raise exception 'Invalid return item' using errcode='22023';
    end;

    select quantity into ordered_quantity
    from public.order_items
    where id = item_id and order_id = p_order_id;

    if not found or item_quantity < 1 or item_quantity > ordered_quantity then
      raise exception 'Invalid return quantity' using errcode='22023';
    end if;

    if exists (
      select 1 from public.return_request_items
      where return_request_id = result_id and order_item_id = item_id
    ) then
      raise exception 'Duplicate return item' using errcode='22023';
    end if;

    insert into public.return_request_items(return_request_id, order_item_id, quantity)
    values(result_id, item_id, item_quantity);
  end loop;

  return result_id;
end
$function$
;
commit;
