begin;

create or replace function private.admin_delete_order(
  p_order_id uuid,
  p_expected_updated_at timestamptz,
  p_confirm_order_number text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order_number text;
  reservation_state text;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_order_id is null or p_expected_updated_at is null
     or p_confirm_order_number is null or length(p_confirm_order_number) > 100 then
    raise exception 'Invalid delete request' using errcode = '22023';
  end if;

  select o.order_number
    into current_order_number
  from public.orders o
  where o.id = p_order_id and o.updated_at = p_expected_updated_at
  for update;
  if not found then
    raise exception 'Record changed or unavailable' using errcode = '40001';
  end if;
  if btrim(p_confirm_order_number) is distinct from current_order_number then
    raise exception 'Order number confirmation does not match' using errcode = '22023';
  end if;

  select r.state into reservation_state
  from private.checkout_reservations r
  where r.order_id = p_order_id
  for update;
  if reservation_state = 'held' then
    raise exception 'Order has an active inventory reservation' using errcode = '23503';
  end if;

  -- order_items is RESTRICT by design; explicit deletion here removes the
  -- historical line snapshots only after the admin confirms the exact order.
  delete from public.order_items where order_id = p_order_id;

  -- Held reservations are blocked above. Resolved reservation rows and their
  -- reserved-item records can now be removed without changing inventory.
  delete from private.checkout_reserved_items where order_id = p_order_id;
  delete from private.checkout_reservations where order_id = p_order_id;

  -- Checkout requests, notification outbox entries and return requests use
  -- ON DELETE CASCADE and are removed with the order.
  delete from public.orders
  where id = p_order_id and updated_at = p_expected_updated_at;
  if not found then
    raise exception 'Record changed or unavailable' using errcode = '40001';
  end if;
end;
$$;

revoke all on function private.admin_delete_order(uuid, timestamptz, text)
  from public, anon, service_role;
grant usage on schema private to authenticated;
grant execute on function private.admin_delete_order(uuid, timestamptz, text)
  to authenticated;

create or replace function public.admin_delete_order(
  p_order_id uuid,
  p_expected_updated_at timestamptz,
  p_confirm_order_number text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.admin_delete_order(p_order_id, p_expected_updated_at, p_confirm_order_number);
$$;

revoke all on function public.admin_delete_order(uuid, timestamptz, text)
  from public, anon, service_role;
grant execute on function public.admin_delete_order(uuid, timestamptz, text)
  to authenticated;

commit;
