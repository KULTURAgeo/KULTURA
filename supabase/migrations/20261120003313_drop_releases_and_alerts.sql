begin;

create table public.drop_releases (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  title_ka text not null default '' check (char_length(title_ka) <= 120),
  launches_at timestamptz not null,
  published boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index drop_releases_public_schedule on public.drop_releases (launches_at, id) where published;
create trigger set_updated_at before update on public.drop_releases
for each row execute function private.set_updated_at();

create table public.drop_release_products (
  release_id uuid not null references public.drop_releases on delete cascade,
  product_id uuid not null references public.products on delete cascade,
  primary key (release_id, product_id)
);
create index drop_release_products_product on public.drop_release_products (product_id);

create table public.drop_alerts (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.drop_releases on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  locale text not null check (locale in ('en', 'ka')),
  created_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  claimed_at timestamptz,
  sent_at timestamptz,
  unique (release_id, user_id)
);
create index drop_alerts_user on public.drop_alerts (user_id);
create index drop_alerts_pending on public.drop_alerts (release_id, created_at, id) where sent_at is null;

alter table public.drop_releases enable row level security;
alter table public.drop_release_products enable row level security;
alter table public.drop_alerts enable row level security;
revoke all on public.drop_releases, public.drop_release_products, public.drop_alerts from public, anon, authenticated;
grant select on public.drop_releases, public.drop_release_products to anon, authenticated;
grant insert, update on public.drop_releases to authenticated;
grant insert, delete on public.drop_release_products to authenticated;
grant select (release_id, user_id, sent_at), insert (release_id, user_id, locale), delete on public.drop_alerts to authenticated;
grant select, update (sent_at) on public.drop_alerts to service_role;

create policy drop_releases_public on public.drop_releases for select to anon, authenticated using (published);
create policy drop_releases_admin on public.drop_releases for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy drop_products_after_launch on public.drop_release_products for select to anon, authenticated using (
  exists (select 1 from public.drop_releases r where r.id = release_id and r.published and r.launches_at <= now())
  and exists (select 1 from public.products p where p.id = product_id and p.status = 'active')
);
create policy drop_products_admin on public.drop_release_products for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy drop_alerts_read_own on public.drop_alerts for select to authenticated using (user_id = (select auth.uid()));
create policy drop_alerts_delete_own on public.drop_alerts for delete to authenticated using (user_id = (select auth.uid()) and sent_at is null);
create policy drop_alerts_insert_own on public.drop_alerts for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (select 1 from public.drop_releases r where r.id = release_id
    and r.published and not r.archived and r.launches_at > now())
);

-- Server-only delivery queue. Store user IDs, look up confirmed email only when
-- sending, and lease rows so two administrators cannot pick up the same batch.
create function public.claim_drop_alerts(p_release_id uuid) returns jsonb
language sql security definer set search_path = '' as $$
  with next_batch as (
    select a.id, u.email
    from public.drop_alerts a
    join public.drop_releases r on r.id = a.release_id
    join auth.users u on u.id = a.user_id
    where r.id = p_release_id and r.published and not r.archived and r.launches_at <= now()
      and a.sent_at is null and u.email_confirmed_at is not null and u.email is not null
      and (a.claimed_at is null or a.claimed_at < now() - interval '5 minutes')
      and (a.first_attempt_at is null or a.first_attempt_at > now() - interval '23 hours')
    order by a.created_at, a.id
    limit 4
    for update of a skip locked
  ), claimed as (
    update public.drop_alerts a
    set claimed_at = now(), first_attempt_at = coalesce(a.first_attempt_at, now())
    from next_batch n where a.id = n.id
    returning a.id, a.locale, a.claimed_at, n.email
  )
  select coalesce(jsonb_agg(to_jsonb(claimed)), '[]'::jsonb) from claimed;
$$;
revoke all on function public.claim_drop_alerts(uuid) from public, anon, authenticated;
grant execute on function public.claim_drop_alerts(uuid) to service_role;
commit;
