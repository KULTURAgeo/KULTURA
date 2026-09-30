-- Admin-managed checkout shipping settings.
begin;

create or replace function public.checkout_get_shipping_settings(
  p_request boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_shipping_total integer;
  v_free_shipping_threshold integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  if p_request is not true then
    raise exception 'Invalid request' using errcode='22023';
  end if;

  select shipping_total, free_shipping_threshold
  into v_shipping_total, v_free_shipping_threshold
  from private.checkout_settings
  where singleton = true;

  if v_shipping_total is null then
    raise exception 'Checkout delivery is not configured' using errcode='22023';
  end if;

  return jsonb_build_object(
    'shipping_total', v_shipping_total,
    'free_shipping_threshold', v_free_shipping_threshold
  );
end
$$;

revoke all on function public.checkout_get_shipping_settings(boolean)
from public, anon, authenticated;
grant execute on function public.checkout_get_shipping_settings(boolean)
to authenticated;

create or replace function public.admin_save_checkout_settings(
  p_shipping_total integer,
  p_free_shipping_threshold integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Forbidden' using errcode='42501';
  end if;

  if p_shipping_total is null or p_shipping_total < 0 or p_shipping_total > 1000000 then
    raise exception 'Invalid shipping total' using errcode='22023';
  end if;

  if p_free_shipping_threshold is not null
     and (p_free_shipping_threshold < 0 or p_free_shipping_threshold > 2147483647) then
    raise exception 'Invalid free shipping threshold' using errcode='22023';
  end if;

  insert into private.checkout_settings (
    singleton,
    shipping_total,
    free_shipping_threshold
  ) values (
    true,
    p_shipping_total,
    p_free_shipping_threshold
  )
  on conflict (singleton)
  do update set
    shipping_total = excluded.shipping_total,
    free_shipping_threshold = excluded.free_shipping_threshold;

  return jsonb_build_object(
    'shipping_total', p_shipping_total,
    'free_shipping_threshold', p_free_shipping_threshold
  );
end
$$;

revoke all on function public.admin_save_checkout_settings(integer,integer)
from public, anon, authenticated;
grant execute on function public.admin_save_checkout_settings(integer,integer)
to authenticated;

comment on function public.checkout_get_shipping_settings(boolean) is
  'Returns checkout delivery pricing for authenticated checkout UI.';
comment on function public.admin_save_checkout_settings(integer,integer) is
  'Admin-only update for checkout shipping price and optional free-shipping threshold.';

commit;
