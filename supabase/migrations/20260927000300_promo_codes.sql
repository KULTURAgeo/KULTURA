begin;

grant select on public.promo_codes to authenticated;

create policy promo_codes_admin_read
on public.promo_codes
for select
to authenticated
using ((select private.is_admin()));

create or replace function private.resolve_promo(
  p_code text,
  p_subtotal integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
  v_promo public.promo_codes%rowtype;
  v_discount integer;
begin
  if p_subtotal is null or p_subtotal < 0 then
    return jsonb_build_object(
      'valid', false,
      'reason', 'subtotal',
      'message', 'Order subtotal is unavailable.'
    );
  end if;

  if v_code = '' or v_code !~ '^[A-Z0-9][A-Z0-9_-]{0,49}$' then
    return jsonb_build_object(
      'valid', false,
      'reason', 'format',
      'message', 'Enter a valid promo code.'
    );
  end if;

  select *
  into v_promo
  from public.promo_codes
  where code = v_code;

  if not found or not v_promo.is_active then
    return jsonb_build_object(
      'valid', false,
      'reason', 'inactive',
      'message', 'Promo code is invalid or inactive.'
    );
  end if;

  if v_promo.starts_at is not null and now() < v_promo.starts_at then
    return jsonb_build_object(
      'valid', false,
      'reason', 'not_started',
      'message', 'This promo code is not active yet.'
    );
  end if;

  if v_promo.expires_at is not null and now() >= v_promo.expires_at then
    return jsonb_build_object(
      'valid', false,
      'reason', 'expired',
      'message', 'This promo code has expired.'
    );
  end if;

  if v_promo.max_uses is not null and v_promo.used_count >= v_promo.max_uses then
    return jsonb_build_object(
      'valid', false,
      'reason', 'exhausted',
      'message', 'This promo code has reached its usage limit.'
    );
  end if;

  if p_subtotal < v_promo.minimum_subtotal then
    return jsonb_build_object(
      'valid', false,
      'reason', 'minimum',
      'message', 'Your merchandise subtotal is below the minimum for this promo code.',
      'minimum_subtotal', v_promo.minimum_subtotal
    );
  end if;

  v_discount := case
    when v_promo.kind = 'fixed' then v_promo.amount
    else floor((p_subtotal::numeric * v_promo.amount::numeric) / 10000)::integer
  end;

  if v_promo.maximum_discount is not null then
    v_discount := least(v_discount, v_promo.maximum_discount);
  end if;

  v_discount := greatest(0, least(v_discount, p_subtotal));

  return jsonb_build_object(
    'valid', true,
    'code', v_promo.code,
    'discount', v_discount,
    'kind', v_promo.kind::text,
    'amount', v_promo.amount,
    'minimum_subtotal', v_promo.minimum_subtotal,
    'maximum_discount', v_promo.maximum_discount
  );
end
$$;

revoke all on function private.resolve_promo(text,integer)
from public, anon, authenticated;

create or replace function public.checkout_quote_promo(
  p_code text,
  p_subtotal integer
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.resolve_promo(p_code, p_subtotal);
$$;

revoke all on function public.checkout_quote_promo(text,integer)
from public, anon, authenticated;
grant execute on function public.checkout_quote_promo(text,integer)
to authenticated;

create or replace function public.admin_save_promo(
  p_id uuid,
  p_expected_updated_at timestamptz,
  p_promo jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.is_admin() then
    raise exception 'Forbidden' using errcode='42501';
  end if;

  if jsonb_typeof(p_promo) <> 'object' then
    raise exception 'Invalid promo input' using errcode='22023';
  end if;

  if p_id is null then
    insert into public.promo_codes(
      code,
      kind,
      amount,
      currency,
      minimum_subtotal,
      maximum_discount,
      starts_at,
      expires_at,
      max_uses,
      is_active
    )
    values(
      upper(trim(p_promo->>'code')),
      (p_promo->>'kind')::public.discount_kind,
      (p_promo->>'amount')::integer,
      p_promo->>'currency',
      (p_promo->>'minimum_subtotal')::integer,
      (p_promo->>'maximum_discount')::integer,
      (p_promo->>'starts_at')::timestamptz,
      (p_promo->>'expires_at')::timestamptz,
      (p_promo->>'max_uses')::integer,
      (p_promo->>'is_active')::boolean
    )
    returning id into v_id;
  else
    update public.promo_codes
    set
      code = upper(trim(p_promo->>'code')),
      kind = (p_promo->>'kind')::public.discount_kind,
      amount = (p_promo->>'amount')::integer,
      currency = p_promo->>'currency',
      minimum_subtotal = (p_promo->>'minimum_subtotal')::integer,
      maximum_discount = (p_promo->>'maximum_discount')::integer,
      starts_at = (p_promo->>'starts_at')::timestamptz,
      expires_at = (p_promo->>'expires_at')::timestamptz,
      max_uses = (p_promo->>'max_uses')::integer,
      is_active = (p_promo->>'is_active')::boolean
    where id = p_id
      and updated_at = p_expected_updated_at
    returning id into v_id;

    if v_id is null then
      raise exception 'Record changed or unavailable' using errcode='40001';
    end if;
  end if;

  return v_id;
end
$$;

revoke all on function public.admin_save_promo(uuid,timestamptz,jsonb)
from public, anon, authenticated;
grant execute on function public.admin_save_promo(uuid,timestamptz,jsonb)
to authenticated;

create function public.admin_create_test_order_v2(
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
    v_promo_snapshot,
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

revoke all on function public.admin_create_test_order_v2(jsonb,jsonb,text)
from public, anon, authenticated;
grant execute on function public.admin_create_test_order_v2(jsonb,jsonb,text)
to authenticated;

commit;
