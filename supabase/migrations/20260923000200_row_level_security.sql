begin;
grant usage on schema public to anon, authenticated;
grant select on public.products, public.product_variants, public.product_images,
  public.categories, public.collections, public.product_collections to anon, authenticated;

create policy categories_public_read on public.categories for select to anon, authenticated using (is_active);
create policy products_public_read on public.products for select to anon, authenticated using (
  status = 'active' and exists (select 1 from public.categories c where c.id = category_id and c.is_active)
);
create policy variants_public_read on public.product_variants for select to anon, authenticated using (
  is_active and exists (select 1 from public.products p where p.id = product_id)
);
create policy images_public_read on public.product_images for select to anon, authenticated using (
  exists (select 1 from public.products p where p.id = product_id)
);
create policy collections_public_read on public.collections for select to anon, authenticated using (is_active);
create policy product_collections_public_read on public.product_collections for select to anon, authenticated using (
  exists (select 1 from public.products p where p.id = product_id)
  and exists (select 1 from public.collections c where c.id = collection_id)
);

grant select on public.profiles, public.addresses, public.orders, public.order_items to authenticated;
-- Table-level UPDATE is deliberately absent: row ownership alone does not protect roles.
grant update (full_name, phone) on public.profiles to authenticated;
create policy profiles_own_read on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_own_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

grant insert (profile_id, recipient_name, phone, country_code, city, address_line_1, address_line_2, postal_code, is_default) on public.addresses to authenticated;
grant update (recipient_name, phone, country_code, city, address_line_1, address_line_2, postal_code, is_default) on public.addresses to authenticated;
grant delete on public.addresses to authenticated;
create policy addresses_own_read on public.addresses for select to authenticated using (profile_id = (select auth.uid()));
create policy addresses_own_insert on public.addresses for insert to authenticated with check (profile_id = (select auth.uid()));
create policy addresses_own_update on public.addresses for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy addresses_own_delete on public.addresses for delete to authenticated using (profile_id = (select auth.uid()));

create policy orders_own_read on public.orders for select to authenticated using (customer_id = (select auth.uid()));
create policy order_items_own_read on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and o.customer_id = (select auth.uid()))
);
-- No INSERT/UPDATE/DELETE policies on catalog, profiles creation, orders, items or
-- promos. Even an authenticated profile with role='admin' has no extra API powers
-- in this phase. Only trusted SQL/service_role can manage these records.
-- No policies or grants on promo_codes for anon/authenticated: codes cannot be enumerated.
commit;
