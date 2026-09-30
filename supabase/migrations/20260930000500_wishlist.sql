begin;

create table public.wishlist_items (
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, product_id)
);

create index wishlist_items_profile_created
  on public.wishlist_items(profile_id, created_at desc);

alter table public.wishlist_items enable row level security;
revoke all on table public.wishlist_items from public, anon, authenticated;
grant all on table public.wishlist_items to service_role;
grant select, insert, delete on table public.wishlist_items to authenticated;

create policy wishlist_owner_select
  on public.wishlist_items
  for select
  to authenticated
  using (profile_id = (select auth.uid()));

create policy wishlist_owner_insert
  on public.wishlist_items
  for insert
  to authenticated
  with check (profile_id = (select auth.uid()));

create policy wishlist_owner_delete
  on public.wishlist_items
  for delete
  to authenticated
  using (profile_id = (select auth.uid()));

commit;
