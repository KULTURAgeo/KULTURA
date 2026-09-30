-- Production order creation before the payment gateway is connected.
-- Orders created here remain PAYMENT=PENDING and FULFILLMENT=UNFULFILLED.
begin;

create or replace function public.checkout_create_unpaid_order(
  p_cart jsonb,
  p_address jsonb,
  p_promo_code text
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
  v_image text;
  v_subtotal bigint := 0;
  v_shipping integer;
  v_discount integer := 0;
  v_promo jsonb;
  v_promo_snapshot text;
  v_city text;
  v_recipient text;
  v_phone text;
  v_address_1 text;
  v_address_2 text;
  v_postal text;
  v_seen_variants uuid[] := '{}'::uuid[];
begin
  if v_customer_id is null then
    raise exception 'Authentication required' using errcode='42501';
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

  -- Validate every line using trusted catalog values and lock product/variant rows
  -- for the duration of this order creation transaction.
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

    if v_variant_id = any(v_seen_variants) then
      raise exception 'Duplicate cart variant' using errcode='22023';
    end if;
    v_seen_variants := array_append(v_seen_variants, v_variant_id);

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
      and v.is_active
    for update of p, v;

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

  -- Keep the current storefront delivery policy authoritative on the server.
  v_shipping := case
    when v_subtotal >= 19900 then 0
    when lower(v_city) in ('tbilisi', 'თბილისი') then 1000
    else 2000
  end;

  if nullif(trim(coalesce(p_promo_code, '')), '') is not null then
    v_promo := private.resolve_promo(p_promo_code, v_subtotal::integer);

    if coalesce((v_promo->>'valid')::boolean, false) is not true then
      raise exception 'Promo code unavailable' using errcode='22023';
    end if;

    v_discount := coalesce((v_promo->>'discount')::integer, 0);
    v_promo_snapshot := v_promo->>'code';
  end if;

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
    promo_code_snapshot,
    paid_at,
    is_test
  )
  values (
    v_customer_id,
    'GEL',
    v_subtotal::integer,
    v_shipping,
    v_discount,
    (v_subtotal + v_shipping - v_discount)::integer,
    'pending',
    'unfulfilled',
    v_customer_email,
    v_recipient,
    v_phone,
    'GE',
    v_city,
    v_address_1,
    v_address_2,
    v_postal,
    v_promo_snapshot,
    null,
    false
  )
  returning id into v_order_id;

  for v_line in
    select value from jsonb_array_elements(p_cart)
  loop
    v_product_id := (v_line->>'product_id')::uuid;
    v_variant_id := (v_line->>'variant_id')::uuid;
    v_quantity := (v_line->>'quantity')::integer;

    select p.name, p.slug, p.price,
           v.sku, v.size, v.color,
           (select pi.image_url
              from public.product_images pi
             where pi.product_id = p.id
               and pi.image_url is not null
             order by pi.sort_position, pi.id
             limit 1)
    into v_name, v_slug, v_price,
         v_sku, v_size, v_color, v_image
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
      v_image,
      v_price,
      v_quantity,
      0,
      v_price * v_quantity
    );
  end loop;

  return v_order_id;
end
$$;

revoke all on function public.checkout_create_unpaid_order(jsonb,jsonb,text)
from public, anon, authenticated;
grant execute on function public.checkout_create_unpaid_order(jsonb,jsonb,text)
to authenticated;

comment on function public.checkout_create_unpaid_order(jsonb,jsonb,text) is
  'Creates an authenticated customer order with pending payment. No payment is taken and inventory is not decremented.';

commit;
