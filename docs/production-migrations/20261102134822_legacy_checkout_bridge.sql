-- LOCAL REHEARSAL CANDIDATE. NOT APPROVED FOR PRODUCTION.
-- Checkout bridge only; remaining security/schema reconciliation is separate.
begin;
do $$ begin
  if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.checkout_submit(uuid,jsonb,text,jsonb,jsonb)'))
      is distinct from '27d251feca45889342c0fee31e34a6f5'
    or (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('private.checkout_price(jsonb,text)'))
      is distinct from '9483ce22174c3a4e61ef9097435e3c03'
    or to_regclass('private.checkout_reservations') is not null
    or to_regclass('private.checkout_requests') is not null
    or to_regprocedure('public.checkout_submit_order(uuid,jsonb,jsonb,text)') is not null then
    raise exception 'Unknown legacy checkout baseline';
  end if;
end $$;
create table if not exists private.checkout_requests (
  customer_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  payload jsonb not null,
  order_id uuid not null references public.orders(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(customer_id, request_id)
);
alter table private.checkout_requests enable row level security;
alter table private.checkout_settings enable row level security;
revoke all on private.checkout_requests from public, anon, authenticated;


create table private.checkout_reservations (
  order_id uuid primary key references public.orders(id) on delete restrict,
  promo_id uuid references public.promo_codes(id) on delete restrict,
  expires_at timestamptz not null default (clock_timestamp()+interval '30 minutes'),
  state text not null default 'held' check(state in ('held','consumed','released')),
  resolved_at timestamptz,
  check ((state='held') = (resolved_at is null))
);
create table private.checkout_reserved_items (
  order_id uuid not null references private.checkout_reservations(order_id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity integer not null check(quantity between 1 and 99),
  primary key(order_id,variant_id)
);
create index checkout_reservations_expiry_idx on private.checkout_reservations(expires_at,order_id) where state='held';
alter table private.checkout_reservations enable row level security;
alter table private.checkout_reserved_items enable row level security;
revoke all on private.checkout_reservations,private.checkout_reserved_items from public,anon,authenticated;

create function private.reserve_checkout_order(p_order uuid,p_promo uuid)
returns void language plpgsql security definer set search_path='' as $$
declare item record;
begin
  if not exists(select 1 from public.orders where id=p_order and payment_status='pending' and not is_test and customer_id=auth.uid()) then
    raise exception 'Invalid reservation order' using errcode='22023';
  end if;
  -- The trusted checkout already holds promo/product/variant locks in this order.
  insert into private.checkout_reservations(order_id,promo_id) values(p_order,p_promo);
  for item in select product_id,variant_id,quantity from public.order_items where order_id=p_order order by product_id,variant_id loop
    -- Registration only: legacy checkout has already debited this quantity.
    insert into private.checkout_reserved_items values(p_order,item.product_id,item.variant_id,item.quantity);
  end loop;
  if not found then raise exception 'Reservation items missing' using errcode='22023'; end if;
end $$;
revoke all on function private.reserve_checkout_order(uuid,uuid) from public,anon,authenticated;

create function private.resolve_checkout_reservation()
returns trigger language plpgsql security definer set search_path='' as $$
declare reservation private.checkout_reservations%rowtype; item record;
begin
  select * into reservation from private.checkout_reservations where order_id=new.id for update;
  if not found then return new; end if; -- Historical and admin test orders remain unchanged.
  if new.payment_status='paid' and old.payment_status is distinct from new.payment_status then
    if reservation.state<>'held' or reservation.expires_at<=clock_timestamp() or new.fulfillment_status='cancelled' then
      raise exception 'Reservation expired or released; payment requires reconciliation' using errcode='22023';
    end if;
    update private.checkout_reservations set state='consumed',resolved_at=clock_timestamp() where order_id=new.id;
  elsif reservation.state='held' and (new.payment_status in ('failed','cancelled') or new.fulfillment_status='cancelled') then
    -- Same promo -> product -> variant order as checkout; order row is locked by UPDATE.
    if reservation.promo_id is not null then
      update public.promo_codes set used_count=used_count-1 where id=reservation.promo_id and used_count>0;
      if not found then raise exception 'Promo reservation accounting mismatch'; end if;
    end if;
    for item in select * from private.checkout_reserved_items where order_id=new.id order by product_id,variant_id loop
      perform 1 from public.products where id=item.product_id for update;
      update public.product_variants set stock_quantity=stock_quantity+item.quantity where id=item.variant_id;
      if not found then raise exception 'Inventory reservation accounting mismatch'; end if;
    end loop;
    update private.checkout_reservations set state='released',resolved_at=clock_timestamp() where order_id=new.id;
  elsif new.payment_status='pending' and reservation.state<>'held' then
    raise exception 'Resolved checkout cannot become pending again' using errcode='22023';
  end if;
  -- Paid returns/refunds do NOT automatically restock goods; inspection is required.
  return new;
end $$;
revoke all on function private.resolve_checkout_reservation() from public,anon,authenticated;
create trigger orders_resolve_checkout_reservation before update of payment_status,fulfillment_status on public.orders
for each row execute function private.resolve_checkout_reservation();

create function private.expire_checkout_reservations(p_limit integer default 100)
returns integer language plpgsql security definer set search_path='' as $$
declare target uuid; targets uuid[]; expired integer:=0;
begin
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'Invalid batch limit' using errcode='22023'; end if;
  -- Serialize workers, not checkout requests; skip busy orders and retry next minute.
  if not pg_try_advisory_xact_lock(741904,301) then return 0; end if;
  select array_agg(id) into targets from (select o.id from public.orders o join private.checkout_reservations r on r.order_id=o.id
    where r.state='held' and r.expires_at<=clock_timestamp() and o.payment_status='pending'
    order by r.expires_at,o.id limit p_limit for update of o skip locked) candidates;
  if targets is null then return 0; end if;
  -- Lock the entire batch before releasing anything. Per-order release could
  -- otherwise lock product X before a later order's promo Y and deadlock checkout.
  perform p.id from public.promo_codes p where p.id in(select promo_id from private.checkout_reservations where order_id=any(targets)) order by p.id for update;
  perform p.id from public.products p where p.id in(select product_id from private.checkout_reserved_items where order_id=any(targets)) order by p.id for update;
  perform v.id from public.product_variants v where v.id in(select variant_id from private.checkout_reserved_items where order_id=any(targets)) order by v.product_id,v.id for update;
  foreach target in array targets loop
    update public.orders set payment_status='cancelled',fulfillment_status='cancelled' where id=target and payment_status='pending';
    expired:=expired+1;
  end loop;
  return expired;
end $$;
revoke all on function private.expire_checkout_reservations(integer) from public,anon,authenticated;


CREATE OR REPLACE FUNCTION private.checkout_price(p_items jsonb, p_promo text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  line jsonb; row_data record; promo public.promo_codes%rowtype;
  qty integer; subtotal bigint := 0; discount bigint := 0; shipping integer; threshold integer;
  lines jsonb := '[]'; promo_input text := upper(trim(coalesce(p_promo,'')));
  allocated jsonb := '[]'; remaining_subtotal bigint; remaining_discount bigint; line_discount bigint;
begin
  if auth.uid() is null then raise exception using errcode='P0001',message='Sign in before checkout.'; end if;
  if length(promo_input)>50 then raise exception using errcode='P0001',message='This promo code is invalid.'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception using errcode='P0001',message='Your bag is invalid.'; end if;
  if jsonb_array_length(p_items) not between 1 and 50 then raise exception using errcode='P0001',message='Your bag must contain 1 to 50 items.'; end if;
  if (select count(distinct x->>'variantId') from jsonb_array_elements(p_items) x) <> jsonb_array_length(p_items)
    then raise exception using errcode='P0001',message='Duplicate bag items are invalid.'; end if;
  select shipping_total,free_shipping_threshold into shipping,threshold from private.checkout_settings where singleton;
  if shipping is null then raise exception using errcode='P0001',message='Delivery pricing is not configured yet. Please try again later.'; end if;
  -- Lock promo, then the entire product/category/variant set in stable order.
  -- The unchanged pricing loop only reacquires locks already held here.
  if promo_input <> '' then
    perform id from public.promo_codes where code=promo_input for update;
  end if;
  perform id from public.products where id in
    (select (value->>'productId')::uuid from jsonb_array_elements(p_items)) order by id for update;
  perform id from public.categories where id in
    (select category_id from public.products where id in
      (select (value->>'productId')::uuid from jsonb_array_elements(p_items))) order by id for update;
  perform id from public.product_variants where id in
    (select (value->>'variantId')::uuid from jsonb_array_elements(p_items)) order by product_id,id for update;
  for line in select value from jsonb_array_elements(p_items) order by value->>'variantId' loop
    if jsonb_typeof(line->'quantity') is distinct from 'number' or (line->>'quantity') !~ '^[0-9]{1,2}$'
      or coalesce(line->>'productId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(line->>'variantId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then raise exception using errcode='P0001',message='A bag item is invalid.'; end if;
    qty := (line->>'quantity')::integer;
    if qty < 1 then raise exception using errcode='P0001',message='Quantity must be at least one.'; end if;
    select p.id product_id,p.name,p.slug,p.price,v.id variant_id,v.sku,v.size,v.color,v.stock_quantity
      into row_data from public.product_variants v join public.products p on p.id=v.product_id
      join public.categories c on c.id=p.category_id
      where v.id=(line->>'variantId')::uuid and p.id=(line->>'productId')::uuid
      and p.status='active' and c.is_active and v.is_active
      for update of v,p,c;
    if not found then raise exception using errcode='P0001',message='An item is no longer available. Update your bag.'; end if;
    if qty > row_data.stock_quantity then raise exception using errcode='P0001',message='Stock changed. Update the quantities in your bag.'; end if;
    subtotal := subtotal + row_data.price::bigint * qty;
    if subtotal > 2146483647 then raise exception using errcode='P0001',message='This order exceeds the supported total.'; end if;
    lines := lines || jsonb_build_array(jsonb_build_object('productId',row_data.product_id,'variantId',row_data.variant_id,
      'name',row_data.name,'slug',row_data.slug,'sku',row_data.sku,'size',row_data.size,'color',row_data.color,
      'quantity',qty,'unitPrice',row_data.price,'lineTotal',row_data.price::bigint*qty,
      'image',(select coalesce(i.image_url,'storage:'||i.storage_path) from public.product_images i where i.product_id=row_data.product_id order by i.sort_position,i.id limit 1)));
  end loop;
  if promo_input <> '' then
    select * into promo from public.promo_codes where promo_codes.code=promo_input for update;
    if not found or not promo.is_active or (promo.starts_at is not null and promo.starts_at > now())
      or (promo.expires_at is not null and promo.expires_at <= now())
      or (promo.max_uses is not null and promo.used_count >= promo.max_uses)
      or subtotal < promo.minimum_subtotal or (promo.kind='fixed' and promo.currency <> 'GEL')
      then raise exception using errcode='P0001',message='This promo code is invalid, expired or not applicable to this bag.'; end if;
    discount := case when promo.kind='fixed' then promo.amount else subtotal*promo.amount/10000 end;
    discount := least(discount,subtotal,coalesce(promo.maximum_discount,2147483647));
  end if;
  if threshold is not null and subtotal >= threshold then shipping := 0; end if;
  remaining_subtotal := subtotal; remaining_discount := discount;
  for line in select value from jsonb_array_elements(lines) loop
    line_discount := case when remaining_subtotal=0 then 0 else remaining_discount*(line->>'lineTotal')::bigint/remaining_subtotal end;
    remaining_discount := remaining_discount-line_discount;
    remaining_subtotal := remaining_subtotal-(line->>'lineTotal')::bigint;
    allocated := allocated || jsonb_build_array(line || jsonb_build_object('discountTotal',line_discount,'lineTotal',(line->>'lineTotal')::bigint-line_discount));
  end loop;
  return jsonb_build_object('lines',allocated,'subtotal',subtotal,'discount',discount,'shipping',shipping,
    'total',subtotal-discount+shipping,'promo',nullif(promo_input,''),'currency','GEL');
end;
$_$;
CREATE OR REPLACE FUNCTION public.checkout_submit(p_key uuid, p_items jsonb, p_promo text, p_customer jsonb, p_expected jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  who uuid := auth.uid(); request_hash text; prior public.orders%rowtype; quote jsonb; line jsonb; order_id uuid;
  field text; limit_length integer;
begin
  if who is null or p_key is null then raise exception using errcode='P0001',message='Sign in before checkout.'; end if;
  -- Serialize retries for a customer before consulting mutable stock/promo state.
  perform 1 from public.profiles where id=who for update;
  if not found then raise exception using errcode='P0001',message='Your account is unavailable.'; end if;
  request_hash := md5(jsonb_build_object('items',p_items,'promo',p_promo,'customer',p_customer,'expected',p_expected)::text);
  select * into prior from public.orders where customer_id=who and checkout_key=p_key;
  if found then
    if prior.checkout_request_hash <> request_hash then raise exception using errcode='P0001',message='This checkout attempt already contains a different order. Open your order history before starting again.'; end if;
    return prior.id;
  end if;
  if (select count(*) from public.orders where customer_id=who and created_at>clock_timestamp()-interval '1 hour' and not is_test)>=10 then
    raise exception 'Checkout rate limit exceeded' using errcode='P0001';
  end if;
  if jsonb_typeof(p_customer) is distinct from 'object' then raise exception using errcode='P0001',message='Complete your delivery information.'; end if;
  foreach field in array array['name','email','phone','city','address1'] loop
    limit_length := case field when 'name' then 200 when 'email' then 254 when 'phone' then 40 when 'city' then 120 else 300 end;
    if jsonb_typeof(p_customer->field) is distinct from 'string' or length(trim(p_customer->>field)) not between 1 and limit_length
      then raise exception using errcode='P0001',message='Complete your delivery information with valid field lengths.'; end if;
  end loop;
  if (p_customer->>'email') !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or p_customer->>'country' is distinct from 'GE'
    then raise exception using errcode='P0001',message='Enter a valid email and a delivery address in Georgia.'; end if;
  if (p_customer->>'phone') !~ '^[+0-9 ()-]+$' or length(regexp_replace(p_customer->>'phone','[^0-9]','','g')) not between 6 and 15
    then raise exception using errcode='P0001',message='Enter a valid delivery phone number.'; end if;
  foreach field in array array['address2','postal','notes'] loop
    limit_length := case field when 'address2' then 300 when 'postal' then 30 else 1000 end;
    if p_customer ? field and (jsonb_typeof(p_customer->field) is distinct from 'string' or length(p_customer->>field)>limit_length)
      then raise exception using errcode='P0001',message='Optional delivery information is too long or invalid.'; end if;
  end loop;
  quote := private.checkout_price(p_items,p_promo);
  if quote is distinct from p_expected then raise exception using errcode='P0001',message='Prices or delivery costs changed. Review your order again before placing it.'; end if;
  insert into public.orders(customer_id,checkout_key,checkout_request_hash,subtotal,shipping_total,discount_total,final_total,
    payment_status,fulfillment_status,customer_email,delivery_name,delivery_phone,delivery_country_code,delivery_city,
    delivery_address_line_1,delivery_address_line_2,delivery_postal_code,delivery_notes,promo_code_snapshot)
  values(who,p_key,request_hash,(quote->>'subtotal')::integer,(quote->>'shipping')::integer,(quote->>'discount')::integer,(quote->>'total')::integer,
    'pending','unfulfilled',trim(p_customer->>'email'),trim(p_customer->>'name'),trim(p_customer->>'phone'),'GE',trim(p_customer->>'city'),
    trim(p_customer->>'address1'),nullif(trim(p_customer->>'address2'),''),nullif(trim(p_customer->>'postal'),''),nullif(trim(p_customer->>'notes'),''),quote->>'promo') returning id into order_id;
  for line in select value from jsonb_array_elements(quote->'lines') loop
    insert into public.order_items(order_id,product_id,variant_id,product_name,product_slug,sku,size,color,image_url,unit_price,quantity,discount_total,line_total)
    values(order_id,(line->>'productId')::uuid,(line->>'variantId')::uuid,line->>'name',line->>'slug',line->>'sku',line->>'size',line->>'color',line->>'image',
      (line->>'unitPrice')::integer,(line->>'quantity')::integer,(line->>'discountTotal')::integer,(line->>'lineTotal')::integer);
    update public.product_variants set stock_quantity=stock_quantity-(line->>'quantity')::integer where id=(line->>'variantId')::uuid;
  end loop;
  if quote->>'promo' is not null then update public.promo_codes set used_count=used_count+1 where code=quote->>'promo'; end if;
  -- Existing implementation has already debited stock and promo exactly once.
  perform private.reserve_checkout_order(order_id,(select id from public.promo_codes where code=quote->>'promo'));
  return order_id;
end;
$_$;
create or replace function public.checkout_submit_order(p_request_id uuid, p_cart jsonb, p_address jsonb, p_promo_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  customer uuid := auth.uid();
  previous private.checkout_requests%rowtype;
  payload jsonb;
  item jsonb;
  canonical_cart jsonb;
  promo text := nullif(upper(trim(p_promo_code)), '');
  promo_id uuid;
  order_id uuid; legacy_cart jsonb; legacy_customer jsonb; expected jsonb;
begin
  if customer is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_request_id is null or jsonb_typeof(p_cart) is distinct from 'array' or jsonb_typeof(p_address) is distinct from 'object' then
    raise exception 'Invalid checkout request' using errcode='22023';
  end if;
  if jsonb_array_length(p_cart) not between 1 and 50 or octet_length(p_address::text) > 12000 or
     (promo is not null and promo !~ '^[A-Z0-9][A-Z0-9_-]{0,49}$') then
    raise exception 'Invalid checkout request' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_each(p_address) e where e.key not in ('recipient_name','phone','city','address_line_1','address_line_2','postal_code','notes') or jsonb_typeof(e.value) not in ('string','null')) then
    raise exception 'Invalid delivery fields' using errcode='22023';
  end if;
  for item in select value from jsonb_array_elements(p_cart) loop
    if jsonb_typeof(item) is distinct from 'object' then raise exception 'Invalid cart item' using errcode='22023'; end if;
    if not (item ?& array['product_id','variant_id','quantity']) or
       exists(select 1 from jsonb_object_keys(item) k where k not in ('product_id','variant_id','quantity')) or
       jsonb_typeof(item->'product_id') is distinct from 'string' or
       jsonb_typeof(item->'variant_id') is distinct from 'string' or
       jsonb_typeof(item->'quantity') is distinct from 'number' or
       (item->>'quantity') !~ '^[1-9][0-9]?$' or
       (item->>'product_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or
       (item->>'variant_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Invalid cart item' using errcode='22023';
    end if;
  end loop;
  -- Deterministic lock order avoids deadlocks for reversed multi-product carts.
  select jsonb_agg(value order by (value->>'product_id')::uuid, (value->>'variant_id')::uuid) into canonical_cart from jsonb_array_elements(p_cart);
  payload := jsonb_build_object('cart',canonical_cart,'address',p_address,'promo',promo);
  -- Serialize submissions for this customer, including different request IDs.
  perform 1 from public.profiles where id=customer for update;
  select * into previous from private.checkout_requests where customer_id=customer and request_id=p_request_id;
  if found then
    if previous.payload is distinct from payload then raise exception 'Request was already used for different details' using errcode='22023'; end if;
    return previous.order_id;
  end if;
  -- Reject cross-protocol key collisions before consulting mutable pricing.
  if exists(select 1 from public.orders where customer_id=customer and checkout_key=p_request_id) then
    raise exception 'Request key already belongs to legacy checkout' using errcode='22023';
  end if;
  select jsonb_agg(jsonb_build_object('productId',value->>'product_id','variantId',value->>'variant_id','quantity',value->'quantity')
    order by value->>'product_id',value->>'variant_id') into legacy_cart from jsonb_array_elements(canonical_cart);
  legacy_customer := jsonb_build_object('name',p_address->>'recipient_name','email',(select email from auth.users where id=customer),
    'phone',p_address->>'phone','country','GE','city',p_address->>'city','address1',p_address->>'address_line_1',
    'address2',coalesce(p_address->>'address_line_2',''),'postal',coalesce(p_address->>'postal_code',''),'notes',coalesce(p_address->>'notes',''));
  expected := private.checkout_price(legacy_cart,promo);
  order_id := public.checkout_submit(p_request_id,legacy_cart,promo,legacy_customer,expected);
  insert into private.checkout_requests(customer_id,request_id,payload,order_id) values(customer,p_request_id,payload,order_id);
  return order_id;
end $$;
revoke all on function public.checkout_submit_order(uuid,jsonb,jsonb,text) from public, anon;
grant execute on function public.checkout_submit_order(uuid,jsonb,jsonb,text) to authenticated;


revoke all on function public.checkout_create_unpaid_order(jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function private.checkout_price(jsonb,text) from public,anon,authenticated;
revoke all on function public.checkout_submit(uuid,jsonb,text,jsonb,jsonb) from public,anon;
grant execute on function public.checkout_submit(uuid,jsonb,text,jsonb,jsonb) to authenticated;
-- Automatic scheduling is deliberately deferred until native concurrency and cron tests pass.
commit;
