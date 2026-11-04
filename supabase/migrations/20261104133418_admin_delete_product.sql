begin;

create or replace function public.admin_delete_product(
  p_id uuid,
  p_expected_updated_at timestamptz,
  p_confirm_name text
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  product_name text;
  image_paths text[];
begin
  if not private.is_admin() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_id is null or p_expected_updated_at is null or p_confirm_name is null
     or length(p_confirm_name) > 200 then
    raise exception 'Invalid delete request' using errcode = '22023';
  end if;

  -- Serialize against catalog updates and checkouts before checking references.
  select p.name into product_name
  from public.products p
  where p.id = p_id and p.updated_at = p_expected_updated_at
  for update;
  if not found then
    raise exception 'Record changed or unavailable' using errcode = '40001';
  end if;
  if btrim(p_confirm_name) is distinct from btrim(product_name) then
    raise exception 'Product name confirmation does not match' using errcode = '22023';
  end if;
  if exists (select 1 from public.order_items oi where oi.product_id = p_id) then
    raise exception 'Products referenced by order history must be archived' using errcode = '23503';
  end if;

  select coalesce(array_agg(pi.storage_path), array[]::text[])
  into image_paths
  from public.product_images pi
  where pi.product_id = p_id and pi.storage_path is not null;

  -- Foreign keys also block deletion if a concurrent or active checkout still uses it.
  delete from public.products where id = p_id;
  return image_paths;
end;
$$;

revoke all on function public.admin_delete_product(uuid, timestamptz, text) from public, anon;
grant execute on function public.admin_delete_product(uuid, timestamptz, text) to authenticated;

commit;
