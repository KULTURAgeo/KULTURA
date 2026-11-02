-- Legacy-compatible quota and notification controls. Apply after reviewed checkout bridge.
-- One-time, atomic migration: refuses existing new objects or unreviewed baseline.
-- No historical notification backfill, no provider calls, no checkout function replacement.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
lock table public.orders,public.notification_outbox,public.profiles,public.addresses,public.wishlist_items,private.checkout_settings in share row exclusive mode;
do $guard$ begin
 if current_user <> 'postgres' then raise exception 'Apply as reviewed postgres owner'; end if;
 if to_regprocedure('public.checkout_submit_order(uuid,jsonb,jsonb,text)') is null or to_regclass('private.checkout_reservations') is null then raise exception 'Reviewed checkout bridge required first'; end if;
 if to_regclass('private.request_limits') is not null then raise exception 'Unexpected existing request_limits'; end if;
 if exists(select 1 from information_schema.columns where (table_schema='public' and table_name='notification_outbox' and column_name in ('email_claimed_at','sms_claimed_at')) or (table_schema='private' and table_name='checkout_settings' and column_name='test_checkout_enabled')) then raise exception 'Unexpected existing security columns'; end if;
 if to_regprocedure('private.customer_rate_limit(text,integer,integer)') is not null then raise exception 'Unexpected existing function: private.customer_rate_limit(text,integer,integer)'; end if;
 if to_regprocedure('private.limit_customer_writes()') is not null then raise exception 'Unexpected existing function: private.limit_customer_writes()'; end if;
 if to_regprocedure('private.guard_test_order()') is not null then raise exception 'Unexpected existing function: private.guard_test_order()'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.notification_prepare(uuid,text)') and md5(prosrc)='bb551ae34b417b76a7c8c56b20752d4a' and pg_get_userbyid(proowner)='postgres') then raise exception 'Unreviewed baseline: public.notification_prepare(uuid,text)'; end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.notification_record_delivery(uuid,text,text)') and md5(prosrc)='32b062678947fda2dbbad22582842eb6' and pg_get_userbyid(proowner)='postgres') then raise exception 'Unreviewed baseline: public.notification_record_delivery(uuid,text,text)'; end if;
 if to_regprocedure('public.notification_claim(uuid,text)') is not null then raise exception 'Unexpected existing function: public.notification_claim(uuid,text)'; end if;
 if to_regprocedure('private.queue_order_notification()') is not null then raise exception 'Unexpected existing function: private.queue_order_notification()'; end if;
 if exists(select 1 from pg_trigger where tgrelid='public.profiles'::regclass and tgname='profiles_write_limit') then raise exception 'Unexpected existing trigger: profiles_write_limit'; end if;
 if exists(select 1 from pg_trigger where tgrelid='public.addresses'::regclass and tgname='addresses_write_limit') then raise exception 'Unexpected existing trigger: addresses_write_limit'; end if;
 if exists(select 1 from pg_trigger where tgrelid='public.wishlist_items'::regclass and tgname='wishlist_write_limit') then raise exception 'Unexpected existing trigger: wishlist_write_limit'; end if;
 if exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='orders_guard_test') then raise exception 'Unexpected existing trigger: orders_guard_test'; end if;
 if exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='orders_queue_notification') then raise exception 'Unexpected existing trigger: orders_queue_notification'; end if;
end $guard$;
create table private.request_limits(customer_id uuid not null references auth.users(id) on delete cascade,scope text not null,window_start timestamptz not null,attempts integer not null check(attempts>0),primary key(customer_id,scope));
alter table private.request_limits enable row level security;
revoke all on private.request_limits from public,anon,authenticated;
alter table private.checkout_settings enable row level security;
alter table private.checkout_settings add column test_checkout_enabled boolean not null default false;
alter table public.notification_outbox add column email_claimed_at timestamptz, add column sms_claimed_at timestamptz;
CREATE OR REPLACE FUNCTION private.customer_rate_limit(p_scope text, p_limit integer, p_seconds integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;
revoke all on function private.customer_rate_limit(text,integer,integer) from public,anon,authenticated;
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
end $function$
;
revoke all on function private.limit_customer_writes() from public,anon,authenticated;
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
end $function$
;
revoke all on function private.guard_test_order() from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.notification_prepare(p_order_id uuid, p_event_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
revoke all on function public.notification_prepare(uuid,text) from public,anon,authenticated;
grant execute on function public.notification_prepare(uuid,text) to service_role;
CREATE OR REPLACE FUNCTION public.notification_record_delivery(p_notification_id uuid, p_channel text, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;
revoke all on function public.notification_record_delivery(uuid,text,text) from public,anon,authenticated;
grant execute on function public.notification_record_delivery(uuid,text,text) to service_role;
CREATE OR REPLACE FUNCTION public.notification_claim(p_notification_id uuid, p_channel text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_channel='email' then
    update public.notification_outbox set email_claimed_at=clock_timestamp()
    where id=p_notification_id and email_claimed_at is null and email_status='pending';
  elsif p_channel='sms' then
    update public.notification_outbox set sms_claimed_at=clock_timestamp()
    where id=p_notification_id and sms_claimed_at is null and sms_status='pending';
  else raise exception 'Invalid channel' using errcode='22023'; end if;
  return found;
end $function$
;
revoke all on function public.notification_claim(uuid,text) from public,anon,authenticated;
grant execute on function public.notification_claim(uuid,text) to service_role;
CREATE OR REPLACE FUNCTION private.queue_order_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;
revoke all on function private.queue_order_notification() from public,anon,authenticated;
CREATE TRIGGER profiles_write_limit BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.limit_customer_writes();
CREATE TRIGGER addresses_write_limit BEFORE INSERT OR UPDATE ON public.addresses FOR EACH ROW EXECUTE FUNCTION private.limit_customer_writes();
CREATE TRIGGER wishlist_write_limit BEFORE INSERT ON public.wishlist_items FOR EACH ROW EXECUTE FUNCTION private.limit_customer_writes();
CREATE TRIGGER orders_guard_test BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION private.guard_test_order();
CREATE TRIGGER orders_queue_notification AFTER INSERT OR UPDATE OF payment_status, fulfillment_status ON public.orders FOR EACH ROW EXECUTE FUNCTION private.queue_order_notification();
commit;
