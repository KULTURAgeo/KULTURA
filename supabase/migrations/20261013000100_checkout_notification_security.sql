-- Reconciled checkout/notification subset of the reviewed security branch.
begin;
-- Refuse unknown function implementations instead of overwriting hosted drift.
-- Hashes normalize CRLF only and cover the reviewed baseline and this migration.
do $$
declare expected record; actual text;
begin
  for expected in select * from (values
    ('public.checkout_create_unpaid_order(jsonb,jsonb,text)', true, array['d46730dfaa22f994777c3fb9a00e03fa']),
    ('public.notification_prepare(uuid,text)', true, array['54e2dca5a00c7908c050627d241e91f2','c05e3cf3662124116af93865d70bb75a']),
    ('public.notification_record_delivery(uuid,text,text)', true, array['a3f74ab4fe6bb0829d09cbae4760165a','53a22ce0e9f5d613e1e2a9675bc55adb']),
    ('private.customer_rate_limit(text,integer,integer)', false, array['f2e243f8fa58ec467f84e682d4d63b27']),
    ('public.checkout_submit_order(uuid,jsonb,jsonb,text)', false, array['7d052c5ba155ff8cd503b9c4ff00b4ae']),
    ('public.notification_claim(uuid,text)', false, array['126c6dcd7fc27870b9843743cfb67601']),
    ('private.queue_order_notification()', false, array['b86184e391d0bc69980e9691c46532f7'])
  ) as reviewed(signature, required, hashes) loop
    select md5(replace(prosrc,chr(13),'')) into actual from pg_proc where oid=to_regprocedure(expected.signature);
    if (actual is null and expected.required) or (actual is not null and not actual=any(expected.hashes)) then
      raise exception 'Function % differs from reviewed baseline; reconcile before applying', expected.signature;
    end if;
  end loop;
  if to_regprocedure('public.checkout_submit_order(uuid,jsonb,jsonb,text)') is null and
     (to_regclass('private.request_limits') is not null or to_regclass('private.checkout_requests') is not null) then
    raise exception 'Unexpected existing checkout security tables; reconcile before applying';
  end if;
end $$;
create table if not exists private.request_limits (
  customer_id uuid not null references auth.users(id) on delete cascade,
  scope text not null,
  window_start timestamptz not null,
  attempts integer not null check (attempts > 0),
  primary key(customer_id, scope)
);
create table if not exists private.checkout_requests (
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

create or replace function private.customer_rate_limit(p_scope text, p_limit integer, p_seconds integer)
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

begin
  if p_channel is null or p_status is null or p_channel not in ('email','sms') or p_status not in ('sent','failed','skipped') then
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

alter table public.notification_outbox add column if not exists email_claimed_at timestamptz;
alter table public.notification_outbox add column if not exists sms_claimed_at timestamptz;
create or replace function public.notification_claim(p_notification_id uuid,p_channel text)
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

create or replace function private.queue_order_notification() returns trigger language plpgsql security definer set search_path='' as $$
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
drop trigger if exists orders_queue_notification on public.orders;
create trigger orders_queue_notification after insert or update of payment_status,fulfillment_status on public.orders for each row execute function private.queue_order_notification();



commit;
