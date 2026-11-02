-- Forward reconciliation of reviewed staging security controls. No data backfill.
begin;
do $$ begin if to_regprocedure('public.checkout_submit(uuid,jsonb,text,jsonb,jsonb)') is not null then raise exception 'Production alternate checkout requires separate reconciliation'; end if; end $$;
do $$ begin if to_regprocedure('private.assert_object_fields(jsonb,text[])') is not null and exists(select 1 from pg_proc where oid=to_regprocedure('private.assert_object_fields(jsonb,text[])') and (pg_get_userbyid(proowner)<>'postgres' or md5(replace(prosrc,chr(13),'')) not in ('9534f98f7574faae8b3d467ce11c7810'))) then raise exception 'Unreviewed function: private.assert_object_fields(jsonb,text[])'; end if; end $$;
do $$ begin if to_regprocedure('private.limit_customer_writes()') is not null and exists(select 1 from pg_proc where oid=to_regprocedure('private.limit_customer_writes()') and (pg_get_userbyid(proowner)<>'postgres' or md5(replace(prosrc,chr(13),'')) not in ('b131c56a2ef923cc794f84e24002c471'))) then raise exception 'Unreviewed function: private.limit_customer_writes()'; end if; end $$;
do $$ begin if to_regprocedure('private.guard_test_order()') is not null and exists(select 1 from pg_proc where oid=to_regprocedure('private.guard_test_order()') and (pg_get_userbyid(proowner)<>'postgres' or md5(replace(prosrc,chr(13),'')) not in ('45dea8b292f34eb8fe60aebda008cb72'))) then raise exception 'Unreviewed function: private.guard_test_order()'; end if; end $$;
do $$ begin if to_regprocedure('public.admin_save_product(uuid,timestamp with time zone,jsonb,uuid[])') is not null and exists(select 1 from pg_proc where oid=to_regprocedure('public.admin_save_product(uuid,timestamp with time zone,jsonb,uuid[])') and (pg_get_userbyid(proowner)<>'postgres' or md5(replace(prosrc,chr(13),'')) not in ('83aa25795dcbe72292683d32cb1a1a9e','9f128721879d74b2cb4c0d7fb39c3041'))) then raise exception 'Unreviewed function: public.admin_save_product(uuid,timestamp with time zone,jsonb,uuid[])'; end if; end $$;
do $$ begin if to_regprocedure('public.customer_save_address(uuid,jsonb)') is not null and exists(select 1 from pg_proc where oid=to_regprocedure('public.customer_save_address(uuid,jsonb)') and (pg_get_userbyid(proowner)<>'postgres' or md5(replace(prosrc,chr(13),'')) not in ('b0814b1b0f5eae642a19f30c42555cb2','2b2dc29800ab085fe71dc7fee44e0cbb'))) then raise exception 'Unreviewed function: public.customer_save_address(uuid,jsonb)'; end if; end $$;
do $$ begin if to_regprocedure('public.admin_save_promo(uuid,timestamp with time zone,jsonb)') is not null and exists(select 1 from pg_proc where oid=to_regprocedure('public.admin_save_promo(uuid,timestamp with time zone,jsonb)') and (pg_get_userbyid(proowner)<>'postgres' or md5(replace(prosrc,chr(13),'')) not in ('2a89d52a22d7059ab9c9efaf091dc4dd','1b30e86bee882b6a7de2ff1036af5cd7'))) then raise exception 'Unreviewed function: public.admin_save_promo(uuid,timestamp with time zone,jsonb)'; end if; end $$;
do $$ begin if to_regprocedure('public.checkout_quote_promo(text,integer)') is not null and exists(select 1 from pg_proc where oid=to_regprocedure('public.checkout_quote_promo(text,integer)') and (pg_get_userbyid(proowner)<>'postgres' or md5(replace(prosrc,chr(13),'')) not in ('fd073929da9098a4cc99b367372bedbc','afe1af71aac16f867f983187944d3ce0'))) then raise exception 'Unreviewed function: public.checkout_quote_promo(text,integer)'; end if; end $$;
do $$ begin if to_regprocedure('public.customer_create_return_request(uuid,text,text,text,jsonb)') is not null and exists(select 1 from pg_proc where oid=to_regprocedure('public.customer_create_return_request(uuid,text,text,text,jsonb)') and (pg_get_userbyid(proowner)<>'postgres' or md5(replace(prosrc,chr(13),'')) not in ('10f5e5cabb4eae565c92a6dfa05e3a29','86320d774833543da35c16ba8c7cbec9'))) then raise exception 'Unreviewed function: public.customer_create_return_request(uuid,text,text,text,jsonb)'; end if; end $$;
alter table private.checkout_settings add column if not exists test_checkout_enabled boolean not null default false;
do $$ begin if not exists(select 1 from information_schema.columns where table_schema='private' and table_name='checkout_settings' and column_name='test_checkout_enabled' and udt_name='bool' and is_nullable='NO') then raise exception 'Unexpected test checkout flag'; end if; end $$;
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
end $function$;
CREATE OR REPLACE FUNCTION private.limit_customer_writes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or private.is_admin() then return new; end if;
  perform private.customer_rate_limit('profile-data', 300, 60);
  if TG_OP='INSERT' then
    perform 1 from public.profiles where id=auth.uid() for update;
    if TG_TABLE_NAME='addresses' and (select count(*) from public.addresses where profile_id=auth.uid())>=50 then raise exception 'Address limit reached' using errcode='22023'; end if;
    if TG_TABLE_NAME='wishlist_items' and (select count(*) from public.wishlist_items where profile_id=auth.uid())>=500 then raise exception 'Wishlist limit reached' using errcode='22023'; end if;
  end if;
  return new;
end $function$;
CREATE OR REPLACE FUNCTION private.guard_test_order()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.is_test and not coalesce((select test_checkout_enabled from private.checkout_settings where singleton),false) then
    raise exception 'Test checkout is disabled' using errcode='42501';
  end if;
  return new;
end $function$;
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
end $function$;
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
end $function$;
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
$function$;
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
end $function$;
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
$function$;
revoke all on function private.assert_object_fields(jsonb,text[]),private.limit_customer_writes(),private.guard_test_order() from public,anon,authenticated;
grant execute on function private.assert_object_fields(jsonb,text[]) to authenticated;
do $$ declare actual text; begin select pg_get_triggerdef(oid) into actual from pg_trigger where tgrelid='public.orders'::regclass and tgname='orders_guard_test'; if actual is null then execute 'CREATE TRIGGER orders_guard_test BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION private.guard_test_order()'; elsif actual<>'CREATE TRIGGER orders_guard_test BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION private.guard_test_order()' then raise exception 'Unreviewed trigger: orders_guard_test'; end if; end $$;
do $$ declare actual text; begin select pg_get_triggerdef(oid) into actual from pg_trigger where tgrelid='public.addresses'::regclass and tgname='addresses_write_limit'; if actual is null then execute 'CREATE TRIGGER addresses_write_limit BEFORE INSERT OR UPDATE ON public.addresses FOR EACH ROW EXECUTE FUNCTION private.limit_customer_writes()'; elsif actual<>'CREATE TRIGGER addresses_write_limit BEFORE INSERT OR UPDATE ON public.addresses FOR EACH ROW EXECUTE FUNCTION private.limit_customer_writes()' then raise exception 'Unreviewed trigger: addresses_write_limit'; end if; end $$;
do $$ declare actual text; begin select pg_get_triggerdef(oid) into actual from pg_trigger where tgrelid='public.wishlist_items'::regclass and tgname='wishlist_write_limit'; if actual is null then execute 'CREATE TRIGGER wishlist_write_limit BEFORE INSERT ON public.wishlist_items FOR EACH ROW EXECUTE FUNCTION private.limit_customer_writes()'; elsif actual<>'CREATE TRIGGER wishlist_write_limit BEFORE INSERT ON public.wishlist_items FOR EACH ROW EXECUTE FUNCTION private.limit_customer_writes()' then raise exception 'Unreviewed trigger: wishlist_write_limit'; end if; end $$;
do $$ declare actual text; begin select pg_get_triggerdef(oid) into actual from pg_trigger where tgrelid='public.profiles'::regclass and tgname='profiles_write_limit'; if actual is null then execute 'CREATE TRIGGER profiles_write_limit BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.limit_customer_writes()'; elsif actual<>'CREATE TRIGGER profiles_write_limit BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.limit_customer_writes()' then raise exception 'Unreviewed trigger: profiles_write_limit'; end if; end $$;
commit;
