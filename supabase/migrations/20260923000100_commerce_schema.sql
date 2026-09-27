-- Money is integer minor units (tetri for GEL). No checkout/payment functions.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create type public.product_status as enum ('draft', 'active', 'archived');
create type public.profile_role as enum ('customer', 'admin');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'cancelled', 'partially_refunded', 'refunded');
create type public.fulfillment_status as enum ('unfulfilled', 'processing', 'shipped', 'delivered', 'cancelled', 'returned');
create type public.discount_kind as enum ('fixed', 'percentage');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (length(full_name) <= 200),
  phone text check (length(phone) <= 40),
  role public.profile_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  is_active boolean not null default false,
  sort_position integer not null default 0 check (sort_position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  price integer not null check (price >= 0),
  compare_at_price integer check (compare_at_price is null or compare_at_price >= price),
  currency text not null default 'GEL' check (currency = 'GEL'),
  status public.product_status not null default 'draft',
  featured boolean not null default false,
  is_drop boolean not null default false,
  category_id uuid not null references public.categories(id) on delete restrict,
  seo_title text check (length(seo_title) <= 200),
  seo_description text check (length(seo_description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique check (sku ~ '^[A-Z0-9][A-Z0-9_-]{0,99}$'),
  size text not null check (length(trim(size)) between 1 and 40 and size = trim(size)),
  color text not null check (length(trim(color)) between 1 and 80 and color = trim(color)),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_active boolean not null default true,
  sort_position integer not null default 0 check (sort_position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, product_id)
);
create unique index product_variants_options_unique on public.product_variants(product_id, lower(size), lower(color));
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text,
  storage_path text,
  alt_text text check (length(alt_text) <= 500),
  sort_position integer not null default 0 check (sort_position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint image_has_one_source check (num_nonnulls(image_url, storage_path) = 1),
  constraint image_url_safe check (image_url is null or image_url ~ '^https://' or image_url ~ '^/images/[a-zA-Z0-9/_-]+[.](jpg|jpeg|png|webp|avif)$'),
  constraint storage_path_safe check (storage_path is null or (length(storage_path) between 1 and 512 and storage_path !~ '(^/|[.][.]|[\\])')),
  unique (product_id, sort_position)
);
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.product_collections (
  product_id uuid not null references public.products(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  sort_position integer not null default 0 check (sort_position >= 0),
  created_at timestamptz not null default now(),
  primary key (product_id, collection_id)
);
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  recipient_name text not null check (length(trim(recipient_name)) between 1 and 200),
  phone text not null check (length(trim(phone)) between 1 and 40),
  country_code text not null default 'GE' check (country_code ~ '^[A-Z]{2}$'),
  city text not null check (length(trim(city)) between 1 and 120),
  address_line_1 text not null check (length(trim(address_line_1)) between 1 and 300),
  address_line_2 text check (length(address_line_2) <= 300),
  postal_code text check (length(postal_code) <= 30),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index addresses_one_default on public.addresses(profile_id) where is_default;

create sequence public.order_number_sequence;
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) on delete set null,
  order_number text not null unique default ('KUL-' || nextval('public.order_number_sequence')::text),
  currency text not null default 'GEL' check (currency ~ '^[A-Z]{3}$'),
  subtotal integer not null check (subtotal >= 0),
  shipping_total integer not null default 0 check (shipping_total >= 0),
  discount_total integer not null default 0 check (discount_total >= 0),
  final_total integer not null check (final_total >= 0),
  payment_status public.payment_status not null default 'pending',
  fulfillment_status public.fulfillment_status not null default 'unfulfilled',
  customer_email text not null check (length(trim(customer_email)) between 3 and 320),
  delivery_name text not null check (length(trim(delivery_name)) between 1 and 200),
  delivery_phone text not null check (length(trim(delivery_phone)) between 1 and 40),
  delivery_country_code text not null check (delivery_country_code ~ '^[A-Z]{2}$'),
  delivery_city text not null check (length(trim(delivery_city)) between 1 and 120),
  delivery_address_line_1 text not null check (length(trim(delivery_address_line_1)) between 1 and 300),
  delivery_address_line_2 text check (length(delivery_address_line_2) <= 300),
  delivery_postal_code text check (length(delivery_postal_code) <= 30),
  promo_code_snapshot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint order_totals_consistent check (final_total::bigint = subtotal::bigint + shipping_total::bigint - discount_total::bigint),
  constraint order_discount_bounded check (discount_total::bigint <= subtotal::bigint + shipping_total::bigint),
  constraint order_number_nonempty check (length(trim(order_number)) between 1 and 100)
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid not null,
  product_name text not null check (length(trim(product_name)) between 1 and 200),
  product_slug text not null,
  sku text not null,
  size text not null,
  color text not null,
  image_url text,
  unit_price integer not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  discount_total integer not null default 0 check (discount_total >= 0),
  line_total integer not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  foreign key (variant_id, product_id) references public.product_variants(id, product_id) on delete restrict,
  constraint item_total_consistent check (line_total::bigint = unit_price::bigint * quantity::bigint - discount_total::bigint),
  constraint item_discount_bounded check (discount_total::bigint <= unit_price::bigint * quantity::bigint)
);
create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9_-]{0,49}$'),
  kind public.discount_kind not null,
  amount integer not null check (amount > 0),
  currency text,
  minimum_subtotal integer not null default 0 check (minimum_subtotal >= 0),
  maximum_discount integer check (maximum_discount > 0),
  starts_at timestamptz,
  expires_at timestamptz,
  max_uses integer check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promo_value_valid check (
    (kind = 'percentage' and amount <= 10000 and currency is null)
    or (kind = 'fixed' and currency is not null and currency ~ '^[A-Z]{3}$')
  ),
  constraint promo_dates_valid check (starts_at is null or expires_at is null or expires_at > starts_at),
  constraint promo_uses_valid check (max_uses is null or used_count <= max_uses)
);
comment on column public.promo_codes.amount is 'Fixed: currency minor units. Percentage: basis points (1000 = 10%). No redemption workflow in Phase 2.';
comment on table public.order_items is 'Immutable purchase snapshots by application policy; never render historical information by joining current product fields. Referenced products/variants must be archived rather than deleted.';
comment on table public.orders is 'Trusted-server-only writes. No checkout API exists yet. Aggregate item totals and inventory reservations require a future atomic order function.';

create index products_public_order on public.products(created_at desc, id) where status = 'active';
create index products_category on public.products(category_id);
create index products_featured on public.products(created_at desc) where status = 'active' and featured;
create index products_drop on public.products(created_at desc) where status = 'active' and is_drop;
create index variants_product_active on public.product_variants(product_id, sort_position) where is_active;
create index product_collections_collection on public.product_collections(collection_id, sort_position);
create index addresses_owner on public.addresses(profile_id);
create index orders_customer_created on public.orders(customer_id, created_at desc);
create index orders_payment_created on public.orders(payment_status, created_at desc);
create index orders_fulfillment_created on public.orders(fulfillment_status, created_at desc);
create index order_items_order on public.order_items(order_id);
create index order_items_product on public.order_items(product_id);
create index order_items_variant_product on public.order_items(variant_id, product_id);

create function private.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;
do $$
declare t text;
begin
  foreach t in array array['profiles','categories','products','product_variants','product_images','collections','addresses','orders','promo_codes']
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', t);
  end loop;
end $$;

-- Ignore auth user metadata entirely, especially user-supplied role claims.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();
insert into public.profiles(id) select id from auth.users on conflict (id) do nothing;

-- Enable RLS inside the same transaction as table creation. No exposure window.
do $$
declare t text;
begin
  foreach t in array array['profiles','products','product_variants','product_images','categories','collections','product_collections','addresses','orders','order_items','promo_codes']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;
revoke all on sequence public.order_number_sequence from public, anon, authenticated;
grant usage, select on sequence public.order_number_sequence to service_role;
commit;
