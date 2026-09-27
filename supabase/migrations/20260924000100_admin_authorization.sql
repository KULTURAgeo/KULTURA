begin;
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
select exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin');
$$;
revoke all on function private.is_admin() from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;
create policy categories_admin_read on public.categories for select to authenticated using ((select private.is_admin()));
create policy collections_admin_read on public.collections for select to authenticated using ((select private.is_admin()));
do $$ declare t text; begin
foreach t in array array['products','product_variants','product_images','product_collections'] loop
execute format('create policy admin_manage on public.%I for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))',t);
end loop; end $$;
grant insert,update on public.products,public.product_variants to authenticated;
grant insert,update,delete on public.product_images to authenticated;
grant insert,delete on public.product_collections to authenticated;
-- Orders remain read-only, including for administrators.
create policy orders_admin_read on public.orders for select to authenticated using ((select private.is_admin()));
create policy order_items_admin_read on public.order_items for select to authenticated using ((select private.is_admin()));
create function public.admin_save_product(p_id uuid,p_expected_updated_at timestamptz,p_product jsonb,p_collection_ids uuid[])
returns uuid language plpgsql security invoker set search_path='' as $$
declare result_id uuid;
begin
if not private.is_admin() then raise exception 'Forbidden' using errcode='42501'; end if;
if jsonb_typeof(p_product)<>'object' or p_collection_ids is null or cardinality(p_collection_ids)>100 then raise exception 'Invalid input' using errcode='22023'; end if;
if p_id is null then
insert into public.products(name,slug,description,price,compare_at_price,status,featured,is_drop,category_id,seo_title,seo_description)
values(p_product->>'name',p_product->>'slug',p_product->>'description',(p_product->>'price')::integer,(p_product->>'compare_at_price')::integer,(p_product->>'status')::public.product_status,(p_product->>'featured')::boolean,(p_product->>'is_drop')::boolean,(p_product->>'category_id')::uuid,p_product->>'seo_title',p_product->>'seo_description') returning id into result_id;
else
update public.products set name=p_product->>'name',slug=p_product->>'slug',description=p_product->>'description',price=(p_product->>'price')::integer,compare_at_price=(p_product->>'compare_at_price')::integer,status=(p_product->>'status')::public.product_status,featured=(p_product->>'featured')::boolean,is_drop=(p_product->>'is_drop')::boolean,category_id=(p_product->>'category_id')::uuid,seo_title=p_product->>'seo_title',seo_description=p_product->>'seo_description' where id=p_id and updated_at=p_expected_updated_at returning id into result_id;
if result_id is null then raise exception 'Record changed or unavailable' using errcode='40001'; end if;
end if;
delete from public.product_collections where product_id=result_id;
insert into public.product_collections(product_id,collection_id) select result_id,x from (select distinct unnest(p_collection_ids) x) s;
return result_id;
end $$;
revoke all on function public.admin_save_product(uuid,timestamptz,jsonb,uuid[]) from public,anon;
grant execute on function public.admin_save_product(uuid,timestamptz,jsonb,uuid[]) to authenticated;
alter table public.product_images drop constraint product_images_product_id_sort_position_key;
alter table public.product_images add constraint product_images_product_id_sort_position_key unique(product_id,sort_position) deferrable initially immediate;
create function public.admin_attach_image(p_product_id uuid,p_storage_path text,p_alt_text text) returns uuid language plpgsql security invoker set search_path='' as $$
declare result_id uuid; next_position integer;
begin
if not private.is_admin() then raise exception 'Forbidden' using errcode='42501'; end if;
perform 1 from public.products where id=p_product_id for update;
if not found then raise exception 'Product unavailable' using errcode='22023'; end if;
if (select count(*) from public.product_images where product_id=p_product_id)>=50 then raise exception 'Maximum images reached' using errcode='22023'; end if;
if p_storage_path !~ ('^'||p_product_id::text||'/[a-f0-9-]{36}[.]webp$') then raise exception 'Invalid image path' using errcode='22023'; end if;
select coalesce(max(sort_position),-1)+1 into next_position from public.product_images where product_id=p_product_id;
insert into public.product_images(product_id,storage_path,alt_text,sort_position) values(p_product_id,p_storage_path,p_alt_text,next_position) returning id into result_id;
return result_id;
end $$;
revoke all on function public.admin_attach_image(uuid,text,text) from public,anon;
grant execute on function public.admin_attach_image(uuid,text,text) to authenticated;
create function public.admin_reorder_images(p_product_id uuid,p_ids uuid[],p_expected_ids uuid[]) returns void language plpgsql security invoker set search_path='' as $$
declare current_ids uuid[];
begin
if not private.is_admin() then raise exception 'Forbidden' using errcode='42501'; end if;
perform 1 from public.products where id=p_product_id for update;
if not found then raise exception 'Product unavailable' using errcode='22023'; end if;
select coalesce(array_agg(id order by sort_position),'{}'::uuid[]) into current_ids from public.product_images where product_id=p_product_id;
if current_ids is distinct from p_expected_ids then raise exception 'Images changed' using errcode='40001'; end if;
if p_ids is null or cardinality(p_ids)<>cardinality(current_ids) or cardinality(p_ids)<>(select count(distinct x) from unnest(p_ids) x) or not p_ids @> current_ids then raise exception 'Invalid image list' using errcode='22023'; end if;
set constraints public.product_images_product_id_sort_position_key deferred;
update public.product_images i set sort_position=s.ord-1 from unnest(p_ids) with ordinality s(id,ord) where i.id=s.id and i.product_id=p_product_id;
end $$;
revoke all on function public.admin_reorder_images(uuid,uuid[],uuid[]) from public,anon;
grant execute on function public.admin_reorder_images(uuid,uuid[],uuid[]) to authenticated;
commit;
