begin;

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null check (event_type in (
    'order_received',
    'payment_paid',
    'payment_failed',
    'payment_refunded',
    'processing',
    'shipped',
    'delivered',
    'order_cancelled',
    'returned'
  )),
  recipient_email text not null,
  recipient_phone text,
  recipient_country_code text,
  payload jsonb not null default '{}'::jsonb,
  email_status text not null default 'pending' check (email_status in ('pending','sent','failed','skipped')),
  sms_status text not null default 'pending' check (sms_status in ('pending','sent','failed','skipped')),
  email_attempts integer not null default 0 check (email_attempts >= 0),
  sms_attempts integer not null default 0 check (sms_attempts >= 0),
  email_sent_at timestamptz,
  sms_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(order_id,event_type)
);

alter table public.notification_outbox enable row level security;
revoke all on table public.notification_outbox from anon, authenticated;

create index notification_outbox_order_created_idx
  on public.notification_outbox(order_id, created_at desc);

create function public.notification_prepare(p_order_id uuid, p_event_type text)
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

  if o.customer_id is distinct from (select auth.uid()) and not private.is_admin() then
    raise exception 'Forbidden' using errcode='42501';
  end if;

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

revoke all on function public.notification_prepare(uuid,text) from public,anon;
grant execute on function public.notification_prepare(uuid,text) to authenticated;

create function public.notification_record_delivery(
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

  select customer_id into customer from public.orders where id=n.order_id;
  if customer is distinct from (select auth.uid()) and not private.is_admin() then
    raise exception 'Forbidden' using errcode='42501';
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

revoke all on function public.notification_record_delivery(uuid,text,text) from public,anon;
grant execute on function public.notification_record_delivery(uuid,text,text) to authenticated;

commit;
