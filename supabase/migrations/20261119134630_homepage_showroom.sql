begin;

create table public.homepage_showroom_settings (
  singleton boolean primary key default true check (singleton),
  use_custom_items boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.homepage_showroom_settings (singleton) values (true);

create type public.showroom_source_kind as enum ('product', 'category');

create table public.homepage_showroom_items (
  id uuid primary key default gen_random_uuid(),
  source_kind public.showroom_source_kind not null,
  product_id uuid references public.products(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,
  image_product_id uuid references public.products(id) on delete set null,
  title text not null default '' check (char_length(title) <= 120),
  title_ka text not null default '' check (char_length(title_ka) <= 120),
  description text not null default '' check (char_length(description) <= 500),
  description_ka text not null default '' check (char_length(description_ka) <= 500),
  sort_position integer not null default 0 check (sort_position between 0 and 1000000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint showroom_source_matches_kind check (
    (source_kind = 'product' and product_id is not null and category_id is null)
    or (source_kind = 'category' and category_id is not null and product_id is null)
  )
);

create index homepage_showroom_items_order on public.homepage_showroom_items(sort_position, id);
create index homepage_showroom_items_product on public.homepage_showroom_items(product_id) where product_id is not null;
create index homepage_showroom_items_category on public.homepage_showroom_items(category_id) where category_id is not null;
create index homepage_showroom_items_image_product on public.homepage_showroom_items(image_product_id) where image_product_id is not null;

alter table public.homepage_showroom_settings enable row level security;
alter table public.homepage_showroom_items enable row level security;

revoke all on public.homepage_showroom_settings, public.homepage_showroom_items from public, anon, authenticated;
grant select on public.homepage_showroom_settings, public.homepage_showroom_items to anon, authenticated;
grant update (use_custom_items) on public.homepage_showroom_settings to authenticated;
grant insert, update, delete on public.homepage_showroom_items to authenticated;

create policy showroom_settings_public_read on public.homepage_showroom_settings
  for select to anon, authenticated using (true);
create policy showroom_settings_admin_update on public.homepage_showroom_settings
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy showroom_admin_manage on public.homepage_showroom_items
  for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

create policy showroom_public_read on public.homepage_showroom_items
  for select to anon, authenticated
  using (
    is_active
    and (select use_custom_items from public.homepage_showroom_settings where singleton)
    and (
      (source_kind = 'category' and exists (
        select 1 from public.categories c where c.id = category_id and c.is_active
      ))
      or (source_kind = 'product' and exists (
        select 1 from public.products p join public.categories c on c.id = p.category_id
        where p.id = product_id and p.status = 'active' and c.is_active
      ))
    )
  );

create function private.enforce_showroom_limit() returns trigger
  language plpgsql security invoker set search_path = '' as $$
begin
  -- Serialize additions so two concurrent requests cannot create a thirteenth card.
  perform 1 from public.homepage_showroom_settings where singleton for update;
  if (select count(*) from public.homepage_showroom_items) >= 12 then
    raise exception 'The 3D showroom supports up to 12 cards' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_showroom_limit() from public, anon, authenticated;
create trigger enforce_showroom_limit before insert on public.homepage_showroom_items
  for each row execute function private.enforce_showroom_limit();
create trigger set_updated_at before update on public.homepage_showroom_settings
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.homepage_showroom_items
  for each row execute function private.set_updated_at();

commit;
