begin;

-- Storefront category navigation: active categories are always rendered in
-- merchandising order and active products are commonly read by category.
create index if not exists categories_active_sort_id_idx
  on public.categories(sort_position, id)
  where is_active;

-- Admin category and product-option screens include inactive rows as well.
create index if not exists categories_admin_sort_name_id_idx
  on public.categories(sort_position, name, id);

create index if not exists collections_name_id_idx
  on public.collections(name, id);

create index if not exists products_active_category_created_id_idx
  on public.products(category_id, created_at desc, id)
  where status = 'active';

-- generateStaticParams reads every active slug ordered by id.
create index if not exists products_active_id_idx
  on public.products(id)
  where status = 'active';

-- Admin product and promo lists are sorted newest-first regardless of status.
create index if not exists products_admin_created_id_idx
  on public.products(created_at desc, id);

create index if not exists promo_codes_created_id_idx
  on public.promo_codes(created_at desc, id);

-- Saved addresses are read per owner with the default address first.
create index if not exists addresses_owner_default_created_idx
  on public.addresses(profile_id, is_default desc, created_at, id);

-- Inventory pages filter by active state / stock and order by stock then SKU.
create index if not exists product_variants_active_stock_sku_idx
  on public.product_variants(stock_quantity, sku)
  where is_active;

create index if not exists product_variants_inactive_stock_sku_idx
  on public.product_variants(stock_quantity, sku)
  where not is_active;

-- Admin order pages and dashboard queries frequently exclude test orders.
create index if not exists orders_created_id_idx
  on public.orders(created_at desc, id);

create index if not exists orders_non_test_created_id_idx
  on public.orders(created_at desc, id)
  where not is_test;

create index if not exists orders_non_test_pending_created_id_idx
  on public.orders(created_at desc, id)
  where not is_test and payment_status = 'pending';

create index if not exists orders_non_test_paid_paid_at_id_idx
  on public.orders(paid_at desc, id)
  where not is_test and payment_status = 'paid';

-- Common admin fulfillment filter: paid orders waiting to start fulfillment.
create index if not exists orders_paid_unfulfilled_created_id_idx
  on public.orders(created_at desc, id)
  where payment_status = 'paid' and fulfillment_status = 'unfulfilled';

-- Best-seller analytics now scans recent order items and filters through the
-- order relation instead of shipping a large order-id list over PostgREST.
create index if not exists order_items_created_order_idx
  on public.order_items(created_at desc, order_id);

-- Return requests can be filtered by request type alone or by status + type.
create index if not exists return_requests_type_created_id_idx
  on public.return_requests(request_type, created_at desc, id);

create index if not exists return_requests_status_type_created_id_idx
  on public.return_requests(status, request_type, created_at desc, id);

commit;
