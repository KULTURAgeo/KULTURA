begin;

alter table public.orders
  add column is_test boolean not null default false;

comment on column public.orders.is_test is
  'True only for administrator-created checkout simulations. Test orders do not reserve or decrement inventory.';

create function public.admin_create_test_order(
  p_cart jsonb,
  p_address jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := auth.uid();
  v_customer_email text;
  v_order_id uuid;
  v_line jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_name text;
  v_slug text;
  v_price integer;
  v_currency text;
  v_sku text;
  v_size text;
  v_color text;
  v_stock integer;
  v_subtotal bigint := 0;
  v_shipping integer;
  v_city text;
  v_recipient text;
  v_phone text;
  v_address_1 text;
  v_address_2 text;
  v_postal text;
begin
  if not private.is_admin() then
    raise exception 'Forbidden' using errcode='42501';
  end if;

  if jsonb_typeof(p_cart) <> 'array'
     or jsonb_array_length(p_cart) < 1
     or jsonb_array_length(p_cart) > 50 then
    raise exception 'Invalid cart' using errcode='22023';
  end if;

  if jsonb_typeof(p_address) <> 'object' then
    raise exception 'Invalid delivery address' using errcode='22023';
  end if;

  v_recipient := trim(coalesce(p_address->>'recipient_name', ''));
  v_phone := trim(coalesce(p_address->>'phone', ''));
  v_city := trim(coalesce(p_address->>'city', ''));
  v_address_1 := trim(coalesce(p_address->>'address_line_1', ''));
  v_address_2 := nullif(trim(coalesce(p_address->>'address_line_2', '')), '');
  v_postal := nullif(trim(coalesce(p_address->>'postal_code', '')), '');

  if length(v_recipient) not between 1 and 200
     or length(v_phone) not between 1 and 40
     or length(v_city) not between 1 and 120
     or length(v_address_1) not between 1 and 300
     or (v_address_2 is not null and length(v_address_2) > 300)
     or (v_postal is not null and length(v_postal) > 30) then
    raise exception 'Invalid delivery address' using errcode='22023';
  end if;

  select email
  into v_customer_email
  from auth.users
  where id = v_customer_id;

  if v_customer_email is null or length(trim(v_customer_email)) < 3 then
    raise exception 'Authenticated email unavailable' using errcode='22023';
  end if;

  for v_line in
    select value from jsonb_array_elements(p_cart)
  loop
    begin
      v_product_id := (v_line->>'product_id')::uuid;
      v_variant_id := (v_line->>'variant_id')::uuid;
      v_quantity := (v_line->>'quantity')::integer;
    exception when others then
      raise exception 'Invalid cart item' using errcode='22023';
    end;

    if v_quantity < 1 or v_quantity > 99 then
      raise exception 'Invalid cart quantity' using errcode='22023';
    end if;

    select p.name, p.slug, p.price, p.currency,
           v.sku, v.size, v.color, v.stock_quantity
    into v_name, v_slug, v_price, v_currency,
         v_sku, v_size, v_color, v_stock
    from public.products p
    join public.product_variants v
      on v.product_id = p.id
    join public.categories c
      on c.id = p.category_id
    where p.id = v_product_id
      and v.id = v_variant_id
      and p.status = 'active'
      and c.is_active
      and v.is_active;

    if not found then
      raise exception 'Cart item unavailable' using errcode='22023';
    end if;

    if v_stock < v_quantity then
      raise exception 'Insufficient stock' using errcode='22023';
    end if;

    if v_currency <> 'GEL' then
      raise exception 'Unsupported currency' using errcode='22023';
    end if;

    v_subtotal := v_subtotal + (v_price::bigint * v_quantity::bigint);

    if v_subtotal > 2147483647 then
      raise exception 'Order total too large' using errcode='22023';
    end if;
  end loop;

  v_shipping := case
    when v_subtotal >= 19900 then 0
    when lower(v_city) in ('tbilisi', 'თბილისი') then 1000
    else 2000
  end;

  insert into public.orders (
    customer_id,
    currency,
    subtotal,
    shipping_total,
    discount_total,
    final_total,
    payment_status,
    fulfillment_status,
    customer_email,
    delivery_name,
    delivery_phone,
    delivery_country_code,
    delivery_city,
    delivery_address_line_1,
    delivery_address_line_2,
    delivery_postal_code,
    paid_at,
    is_test
  )
  values (
    v_customer_id,
    'GEL',
    v_subtotal::integer,
    v_shipping,
    0,
    (v_subtotal + v_shipping)::integer,
    'paid',
    'unfulfilled',
    v_customer_email,
    v_recipient,
    v_phone,
    'GE',
    v_city,
    v_address_1,
    v_address_2,
    v_postal,
    now(),
    true
  )
  returning id into v_order_id;

  for v_line in
    select value from jsonb_array_elements(p_cart)
  loop
    v_product_id := (v_line->>'product_id')::uuid;
    v_variant_id := (v_line->>'variant_id')::uuid;
    v_quantity := (v_line->>'quantity')::integer;

    select p.name, p.slug, p.price,
           v.sku, v.size, v.color
    into v_name, v_slug, v_price,
         v_sku, v_size, v_color
    from public.products p
    join public.product_variants v
      on v.product_id = p.id
    where p.id = v_product_id
      and v.id = v_variant_id;

    insert into public.order_items (
      order_id,
      product_id,
      variant_id,
      product_name,
      product_slug,
      sku,
      size,
      color,
      image_url,
      unit_price,
      quantity,
      discount_total,
      line_total
    )
    values (
      v_order_id,
      v_product_id,
      v_variant_id,
      v_name,
      v_slug,
      v_sku,
      v_size,
      v_color,
      null,
      v_price,
      v_quantity,
      0,
      v_price * v_quantity
    );
  end loop;

  return v_order_id;
end
$$;

revoke all on function public.admin_create_test_order(jsonb,jsonb)
  from public, anon, authenticated;

grant execute on function public.admin_create_test_order(jsonb,jsonb)
  to authenticated;

commit;
