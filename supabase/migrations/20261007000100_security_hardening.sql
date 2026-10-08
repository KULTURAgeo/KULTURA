-- Apply once after the existing migrations. No bootstrap or data reset.
begin;

create table private.request_limits (
  customer_id uuid not null references auth.users(id) on delete cascade,
  scope text not null,
  window_start timestamptz not null,
  attempts integer not null check (attempts > 0),
  primary key(customer_id, scope)
);
create table private.checkout_requests (
  customer_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  payload jsonb not null,
  order_id uuid not null references public.orders(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(customer_id, request_id)
);
alter table private.request_limits enable row level security;
alter table private.checkout_requests enable row level security;
alter table private.checkout_settings enable row level security;
revoke all on private.request_limits, private.checkout_requests from public, anon, authenticated;

create function private.customer_rate_limit(p_scope text, p_limit integer, p_seconds integer)
returns void language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  insert into private.request_limits(customer_id, scope, window_start, attempts)
  values(auth.uid(), p_scope, clock_timestamp(), 1)
  on conflict(customer_id, scope) do update set
    attempts = case when request_limits.window_start + make_interval(secs => p_seconds) <= clock_timestamp() then 1 else request_limits.attempts + 1 end,
    window_start = case when request_limits.window_start + make_interval(secs => p_seconds) <= clock_timestamp() then clock_timestamp() else request_limits.window_start end
  returning attempts into n;
  if n > p_limit then raise exception 'Too many requests' using errcode='PT429'; end if;
end $$;
revoke all on function private.customer_rate_limit(text,integer,integer) from public, anon, authenticated;

-- Legacy implementation remains callable only by the trusted wrapper. Revoking
-- its public API grant is essential: an attacker must not bypass idempotency.
revoke all on function public.checkout_create_unpaid_order(jsonb,jsonb,text) from public, anon, authenticated;

create function public.checkout_submit_order(p_request_id uuid, p_cart jsonb, p_address jsonb, p_promo_code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  customer uuid := auth.uid();
  previous private.checkout_requests%rowtype;
  payload jsonb;
  item jsonb;
  canonical_cart jsonb;
  promo text := nullif(upper(trim(p_promo_code)), '');
  promo_id uuid;
  order_id uuid;
begin
  if customer is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_request_id is null or jsonb_typeof(p_cart) is distinct from 'array' or jsonb_typeof(p_address) is distinct from 'object' then
    raise exception 'Invalid checkout request' using errcode='22023';
  end if;
  if jsonb_array_length(p_cart) not between 1 and 50 or octet_length(p_address::text) > 12000 or
     (promo is not null and promo !~ '^[A-Z0-9][A-Z0-9_-]{0,49}$') then
    raise exception 'Invalid checkout request' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_each(p_address) e where e.key not in ('recipient_name','phone','city','address_line_1','address_line_2','postal_code') or jsonb_typeof(e.value) not in ('string','null')) then
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
  perform private.customer_rate_limit('checkout', 10, 3600);
  if promo is not null then
    select id into promo_id from public.promo_codes where code=promo and (kind='percentage' or currency='GEL') for update;
    if not found then raise exception 'Promo code unavailable' using errcode='22023'; end if;
  end if;
  order_id := public.checkout_create_unpaid_order(canonical_cart, p_address, promo);
  -- One accepted real order consumes one use. Test orders and idempotent retries
  -- do not consume uses. Cancelled orders retain the historical use count.
  if promo_id is not null then
    update public.promo_codes set used_count=used_count+1 where id=promo_id and (max_uses is null or used_count<max_uses);
    if not found then raise exception 'Promo code unavailable' using errcode='22023'; end if;
  end if;
  insert into private.checkout_requests(customer_id,request_id,payload,order_id) values(customer,p_request_id,payload,order_id);
  return order_id;
end $$;
revoke all on function public.checkout_submit_order(uuid,jsonb,jsonb,text) from public, anon;
grant execute on function public.checkout_submit_order(uuid,jsonb,jsonb,text) to authenticated;

create or replace function public.checkout_quote_promo(p_code text, p_subtotal integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.customer_rate_limit('promo', 60, 3600);
  if p_code is null or length(p_code)>50 or p_subtotal is null or p_subtotal<0 then raise exception 'Invalid promo request' using errcode='22023'; end if;
  return private.resolve_promo(p_code,p_subtotal);
end $$;

-- Delivery audit records are backend-owned. Customer JWTs must not be able to
-- fabricate notification events or acknowledge messages that were never sent.
revoke all on function public.notification_prepare(uuid,text) from public,anon,authenticated;
revoke all on function public.notification_record_delivery(uuid,text,text) from public,anon,authenticated;
grant execute on function public.notification_prepare(uuid,text) to service_role;
grant execute on function public.notification_record_delivery(uuid,text,text) to service_role;

-- Gate the existing administrator sandbox at the database as well as in the UI.
alter table private.checkout_settings add column test_checkout_enabled boolean not null default false;
create function private.guard_test_order() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.is_test and not coalesce((select test_checkout_enabled from private.checkout_settings where singleton),false) then
    raise exception 'Test checkout is disabled' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function private.guard_test_order() from public,anon,authenticated;
create trigger orders_guard_test before insert on public.orders for each row execute function private.guard_test_order();

create or replace function public.notification_prepare(p_order_id uuid, p_event_type text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders%rowtype;
  n public.notification_outbox%rowtype;
begin
  if p_event_type not in (
    'order_received',
    'payment_paid',
    'payment_failed',
    'payment_refunded',
    'processing',
    'shipped',
    'delivered',
    'order_cancelled',
    'returned'
  ) then
    raise exception 'Invalid notification event' using errcode='22023';
  end if;

  select * into o from public.orders where id=p_order_id;
  if not found then
    raise exception 'Order unavailable' using errcode='22023';
  end if;

  if p_event_type is null or not (
    p_event_type='order_received' or
    (p_event_type='payment_paid' and o.payment_status='paid') or
    (p_event_type='payment_failed' and o.payment_status in ('failed','cancelled')) or
    (p_event_type='payment_refunded' and o.payment_status in ('refunded','partially_refunded')) or
    (p_event_type in ('processing','shipped','delivered','returned') and o.fulfillment_status::text=p_event_type) or
    (p_event_type='order_cancelled' and o.fulfillment_status='cancelled')
  ) then raise exception 'Notification does not match order state' using errcode='22023'; end if;

  if o.is_test then
    return jsonb_build_object('skip', true);
  end if;

  insert into public.notification_outbox(
    order_id,
    event_type,
    recipient_email,
    recipient_phone,
    recipient_country_code,
    payload
  ) values (
    o.id,
    p_event_type,
    o.customer_email,
    o.delivery_phone,
    o.delivery_country_code,
    jsonb_build_object(
      'order_number', o.order_number,
      'delivery_name', o.delivery_name,
      'currency', o.currency,
      'final_total', o.final_total,
      'payment_status', o.payment_status,
      'fulfillment_status', o.fulfillment_status
    )
  ) on conflict(order_id,event_type) do nothing;

  select * into n
  from public.notification_outbox
  where order_id=p_order_id and event_type=p_event_type;

  return jsonb_build_object(
    'skip', false,
    'id', n.id,
    'order_id', n.order_id,
    'event_type', n.event_type,
    'recipient_email', n.recipient_email,
    'recipient_phone', n.recipient_phone,
    'recipient_country_code', n.recipient_country_code,
    'payload', n.payload,
    'email_status', n.email_status,
    'sms_status', n.sms_status
  );
end
$$;

revoke all on function public.notification_prepare(uuid,text) from public,anon,authenticated;
grant execute on function public.notification_prepare(uuid,text) to service_role;

create or replace function public.notification_record_delivery(
  p_notification_id uuid,
  p_channel text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n public.notification_outbox%rowtype;
  customer uuid;
begin
  if p_channel not in ('email','sms') or p_status not in ('sent','failed','skipped') then
    raise exception 'Invalid notification result' using errcode='22023';
  end if;

  select * into n from public.notification_outbox where id=p_notification_id;
  if not found then
    raise exception 'Notification unavailable' using errcode='22023';
  end if;



  if p_channel='email' then
    update public.notification_outbox
    set email_status=p_status,
        email_attempts=email_attempts+1,
        email_sent_at=case when p_status='sent' then now() else email_sent_at end,
        updated_at=now()
    where id=p_notification_id;
  else
    update public.notification_outbox
    set sms_status=p_status,
        sms_attempts=sms_attempts+1,
        sms_sent_at=case when p_status='sent' then now() else sms_sent_at end,
        updated_at=now()
    where id=p_notification_id;
  end if;
end
$$;

revoke all on function public.notification_record_delivery(uuid,text,text) from public,anon,authenticated;
grant execute on function public.notification_record_delivery(uuid,text,text) to service_role;

alter table public.notification_outbox add column email_claimed_at timestamptz;
alter table public.notification_outbox add column sms_claimed_at timestamptz;
create function public.notification_claim(p_notification_id uuid,p_channel text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_channel='email' then
    update public.notification_outbox set email_claimed_at=clock_timestamp()
    where id=p_notification_id and email_claimed_at is null and email_status='pending';
  elsif p_channel='sms' then
    update public.notification_outbox set sms_claimed_at=clock_timestamp()
    where id=p_notification_id and sms_claimed_at is null and sms_status='pending';
  else raise exception 'Invalid channel' using errcode='22023'; end if;
  return found;
end $$;
revoke all on function public.notification_claim(uuid,text) from public,anon,authenticated;
grant execute on function public.notification_claim(uuid,text) to service_role;

create function private.queue_order_notification() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.is_test then return new; end if;
  if TG_OP='INSERT' then perform public.notification_prepare(new.id,'order_received');
  else
    if new.payment_status is distinct from old.payment_status then
      if new.payment_status in ('paid','failed','refunded') then perform public.notification_prepare(new.id,'payment_' || new.payment_status::text);
      elsif new.payment_status='cancelled' then perform public.notification_prepare(new.id,'payment_failed');
      elsif new.payment_status='partially_refunded' then perform public.notification_prepare(new.id,'payment_refunded'); end if;
    end if;
    if new.fulfillment_status is distinct from old.fulfillment_status then
      if new.fulfillment_status='cancelled' then perform public.notification_prepare(new.id,'order_cancelled');
      elsif new.fulfillment_status in ('processing','shipped','delivered','returned') then perform public.notification_prepare(new.id,new.fulfillment_status::text); end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function private.queue_order_notification() from public,anon,authenticated;
create trigger orders_queue_notification after insert or update of payment_status,fulfillment_status on public.orders for each row execute function private.queue_order_notification();


create function private.assert_object_fields(p_value jsonb, p_fields text[])
returns void language plpgsql immutable set search_path='' as $$
begin
  if jsonb_typeof(p_value) is distinct from 'object' then raise exception 'Invalid object' using errcode='22023'; end if;
  if octet_length(p_value::text)>65536 or exists(select 1 from jsonb_each(p_value) e where not(e.key=any(p_fields)) or jsonb_typeof(e.value) in ('object','array')) then
    raise exception 'Unexpected object fields' using errcode='22023';
  end if;
end $$;
revoke all on function private.assert_object_fields(jsonb,text[]) from public,anon;
grant execute on function private.assert_object_fields(jsonb,text[]) to authenticated;

create or replace function public.customer_save_address(p_id uuid,p_address jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
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
end $$;

create or replace function public.admin_save_product(p_id uuid,p_expected_updated_at timestamptz,p_product jsonb,p_collection_ids uuid[])
returns uuid language plpgsql security invoker set search_path='' as $$
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
end $$;

create or replace function public.admin_save_promo(
  p_id uuid,
  p_expected_updated_at timestamptz,
  p_promo jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

create or replace function public.customer_create_return_request(
  p_order_id uuid,
  p_request_type text,
  p_reason text,
  p_details text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

-- Direct REST writes are also bounded. Profile locks serialize per-owner quotas.
create function private.limit_customer_writes() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or private.is_admin() then return new; end if;
  perform private.customer_rate_limit('profile-data', 300, 60);
  if TG_OP='INSERT' then
    perform 1 from public.profiles where id=auth.uid() for update;
    if TG_TABLE_NAME='addresses' and (select count(*) from public.addresses where profile_id=auth.uid())>=50 then raise exception 'Address limit reached' using errcode='22023'; end if;
    if TG_TABLE_NAME='wishlist_items' and (select count(*) from public.wishlist_items where profile_id=auth.uid())>=500 then raise exception 'Wishlist limit reached' using errcode='22023'; end if;
  end if;
  return new;
end $$;
revoke all on function private.limit_customer_writes() from public,anon,authenticated;
create trigger addresses_write_limit before insert or update on public.addresses for each row execute function private.limit_customer_writes();
create trigger wishlist_write_limit before insert on public.wishlist_items for each row execute function private.limit_customer_writes();
create trigger profiles_write_limit before update on public.profiles for each row execute function private.limit_customer_writes();
-- Include historical real orders without reducing manually maintained counts.
update public.promo_codes p set used_count=greatest(p.used_count,
  (select count(*)::integer from public.orders o where not o.is_test and o.promo_code_snapshot=p.code));

commit;
