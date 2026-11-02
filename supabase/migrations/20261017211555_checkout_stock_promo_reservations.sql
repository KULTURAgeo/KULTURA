-- Candidate forward migration. Tested locally before hosted application.
-- Merchant-approved: NEW orders reserve stock/promo for 30 minutes.
-- No historical order, stock or promo-counter backfill.
begin;
do $$ begin
  if to_regclass('private.checkout_reservations') is not null then
    raise exception 'Reservation objects already exist; inspect history, do not replay';
  end if;
  if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.checkout_submit_order(uuid,jsonb,jsonb,text)')) is distinct from '7d052c5ba155ff8cd503b9c4ff00b4ae'
    or (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.checkout_create_unpaid_order(jsonb,jsonb,text)')) is distinct from 'd46730dfaa22f994777c3fb9a00e03fa'
    or to_regprocedure('public.checkout_submit(uuid,jsonb,text,jsonb,jsonb)') is not null then
    raise exception 'Unknown checkout accounting baseline; reconcile before applying';
  end if;
  if exists(select 1 from pg_proc where oid in (
      'public.checkout_submit_order(uuid,jsonb,jsonb,text)'::regprocedure,
      'public.checkout_create_unpaid_order(jsonb,jsonb,text)'::regprocedure)
    and (pg_get_userbyid(proowner)<>'postgres' or not prosecdef or not coalesce(proconfig @> array['search_path=""'],false)))
    or has_function_privilege('authenticated','public.checkout_create_unpaid_order(jsonb,jsonb,text)','execute')
    or has_function_privilege('anon','public.checkout_submit_order(uuid,jsonb,jsonb,text)','execute') then
    raise exception 'Unexpected checkout owner, search path or grants';
  end if;
end $$;

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
    update public.product_variants set stock_quantity=stock_quantity-item.quantity
      where id=item.variant_id and product_id=item.product_id and stock_quantity>=item.quantity;
    if not found then raise exception 'Insufficient stock' using errcode='22023'; end if;
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

do $$ declare definition text; needle text := '  insert into private.checkout_requests(customer_id,request_id,payload,order_id)'; begin
  select pg_get_functiondef('public.checkout_submit_order(uuid,jsonb,jsonb,text)'::regprocedure) into definition;
  if position(needle in definition)=0 then raise exception 'Checkout insertion point missing'; end if;
  execute replace(definition,needle,'  perform private.reserve_checkout_order(order_id,promo_id);'||chr(10)||needle);
end $$;
-- Supabase supplies pg_cron. Disposable PGlite/portable PostgreSQL do not;
-- those environments test the same expiry function explicitly, not a fake cron.
do $$ begin
  if exists(select 1 from pg_available_extensions where name='pg_cron') then
    execute 'create extension if not exists pg_cron with schema pg_catalog';
    if exists(select 1 from cron.job where jobname='kultura-checkout-reservation-expiry') then
      raise exception 'Existing expiry job must be reviewed before replacement';
    end if;
    perform cron.schedule('kultura-checkout-reservation-expiry','* * * * *',
      'BEGIN; SET LOCAL lock_timeout=''2s''; SET LOCAL statement_timeout=''20s''; SELECT private.expire_checkout_reservations(100); COMMIT;');
  else
    raise notice 'pg_cron unavailable: automatic expiry NOT configured; only disposable local testing is supported';
  end if;
end $$;
commit;
