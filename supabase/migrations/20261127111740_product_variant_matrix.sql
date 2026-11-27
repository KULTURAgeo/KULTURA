begin;

alter table public.products
  add column base_sku text check (base_sku ~ '^[A-Z0-9][A-Z0-9_-]{0,39}$');

create table public.product_colors (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null check (name = trim(name) and length(name) between 1 and 80),
  name_key text generated always as (lower(name)) stored,
  hex text check (hex ~ '^#[0-9a-fA-F]{6}$'),
  sort_position integer not null default 0 check (sort_position >= 0),
  unique (product_id, name_key),
  unique (id, product_id)
);

alter table public.product_colors enable row level security;
revoke all on public.product_colors from public, anon, authenticated;
grant select on public.product_colors to anon, authenticated;
grant insert, update on public.product_colors to authenticated;
create policy product_colors_public_read on public.product_colors for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'active'));
create policy product_colors_admin_manage on public.product_colors for all to authenticated
  using ((select private.is_admin()) and (select auth.jwt() ->> 'aal') = 'aal2')
  with check ((select private.is_admin()) and (select auth.jwt() ->> 'aal') = 'aal2');

insert into public.product_colors (product_id, name)
select distinct on (v.product_id, lower(v.color)) v.product_id, v.color
from public.product_variants v
order by v.product_id, lower(v.color), v.sort_position, v.id;

alter table public.product_variants add column color_id uuid;
update public.product_variants v
set color_id = c.id
from public.product_colors c
where c.product_id = v.product_id and c.name_key = lower(v.color);
alter table public.product_variants
  add constraint product_variants_color_linked check (color_id is not null),
  add constraint product_variants_product_color_fkey foreign key (color_id, product_id)
    references public.product_colors(id, product_id);
create index product_variants_color_idx on public.product_variants(color_id, product_id);

-- Keep the existing color text for checkout snapshots and older application releases.
create function private.sync_variant_color() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.product_colors(product_id, name)
  values (new.product_id, new.color)
  on conflict (product_id, name_key) do nothing;

  select c.id, c.name into new.color_id, new.color
  from public.product_colors c
  where c.product_id = new.product_id and c.name_key = lower(new.color);
  return new;
end;
$$;
revoke all on function private.sync_variant_color() from public, anon, authenticated;
create trigger product_variants_sync_color
before insert or update of color, product_id, color_id on public.product_variants
for each row execute function private.sync_variant_color();

create function public.admin_save_variant_matrix(
  p_product_id uuid, p_expected_updated_at timestamptz, p_base_sku text,
  p_colors jsonb, p_variants jsonb
) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  row_data record;
  saved integer := 0;
begin
  if not private.is_admin() or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_base_sku is null or p_base_sku !~ '^[A-Z0-9][A-Z0-9_-]{0,39}$'
      or jsonb_typeof(p_colors) is distinct from 'array'
      or jsonb_typeof(p_variants) is distinct from 'array' then
    raise exception 'Invalid variant matrix' using errcode = '22023';
  end if;
  if jsonb_array_length(p_colors) > 60 or jsonb_array_length(p_variants) > 180 then
    raise exception 'Too many changes in one save' using errcode = '22023';
  end if;

  update public.products set base_sku = p_base_sku
  where id = p_product_id and updated_at = p_expected_updated_at;
  if not found then
    raise exception 'Product was changed' using errcode = '40001';
  end if;

  insert into public.product_colors(product_id, name, hex, sort_position)
  select p_product_id, c.name, c.hex, c.sort_position
  from jsonb_to_recordset(p_colors) as c(name text, hex text, sort_position integer)
  on conflict (product_id, name_key) do update
  set hex = excluded.hex, sort_position = excluded.sort_position;

  -- The same lock order as checkout reservations. Changes roll back together on conflict.
  for row_data in
    select * from jsonb_to_recordset(p_variants) as v(
      id uuid, updated_at timestamptz, color text, size text, sku text,
      stock_quantity integer, is_active boolean, sort_position integer
    ) order by id nulls last, sort_position
  loop
    if row_data.stock_quantity is null or row_data.stock_quantity not between 0 and 1000000 then
      raise exception 'Invalid stock quantity' using errcode = '22023';
    end if;
    if row_data.id is null then
      insert into public.product_variants(product_id, color, size, sku, stock_quantity, is_active, sort_position)
      values (p_product_id, row_data.color, row_data.size, row_data.sku,
        row_data.stock_quantity, row_data.is_active, row_data.sort_position);
    else
      update public.product_variants
      set sku = row_data.sku, stock_quantity = row_data.stock_quantity, is_active = row_data.is_active
      where id = row_data.id and product_id = p_product_id and updated_at = row_data.updated_at;
      if not found then
        raise exception 'Variant inventory was changed' using errcode = '40001';
      end if;
    end if;
    saved := saved + 1;
  end loop;
  return saved;
end;
$$;
revoke all on function public.admin_save_variant_matrix(uuid,timestamptz,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.admin_save_variant_matrix(uuid,timestamptz,text,jsonb,jsonb) to authenticated;

commit;
