begin;

create or replace function public.admin_advance_fulfillment(
  p_order_id uuid,
  p_expected_updated_at timestamptz,
  p_next_status public.fulfillment_status
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status public.fulfillment_status;
  current_payment public.payment_status;
  current_updated_at timestamptz;
  allowed_next public.fulfillment_status;
  result_updated_at timestamptz;
begin
  if not private.is_admin() then
    raise exception 'Forbidden' using errcode='42501';
  end if;

  select fulfillment_status, payment_status, updated_at
  into current_status, current_payment, current_updated_at
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order unavailable' using errcode='P0002';
  end if;

  if current_updated_at is distinct from p_expected_updated_at then
    raise exception 'Order changed' using errcode='40001';
  end if;

  allowed_next := case current_status
    when 'unfulfilled' then 'processing'::public.fulfillment_status
    when 'processing' then 'shipped'::public.fulfillment_status
    when 'shipped' then 'delivered'::public.fulfillment_status
    else null
  end;

  if allowed_next is null or p_next_status is distinct from allowed_next then
    raise exception 'Invalid fulfillment transition' using errcode='22023';
  end if;

  if current_status = 'unfulfilled' and current_payment <> 'paid' then
    raise exception 'Order must be paid before fulfillment starts' using errcode='22023';
  end if;

  update public.orders
  set fulfillment_status = p_next_status,
      updated_at = now()
  where id = p_order_id
  returning updated_at into result_updated_at;

  return result_updated_at;
end
$$;

revoke all on function public.admin_advance_fulfillment(uuid,timestamptz,public.fulfillment_status) from public, anon, authenticated;
grant execute on function public.admin_advance_fulfillment(uuid,timestamptz,public.fulfillment_status) to authenticated;

commit;
