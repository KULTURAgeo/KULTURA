begin;

create table public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  request_type text not null check (request_type in ('return','refund')),
  reason text not null check (reason in (
    'wrong_size',
    'damaged',
    'not_as_described',
    'changed_mind',
    'duplicate_order',
    'other'
  )),
  details text not null default '' check (char_length(details) <= 2000),
  status text not null default 'requested' check (status in (
    'requested',
    'under_review',
    'approved',
    'rejected',
    'resolved'
  )),
  admin_note text not null default '' check (char_length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.return_request_items (
  return_request_id uuid not null references public.return_requests(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  primary key (return_request_id, order_item_id)
);

create unique index return_requests_one_active_per_order_idx
  on public.return_requests(order_id)
  where status in ('requested','under_review','approved');

create index return_requests_status_created_idx
  on public.return_requests(status, created_at desc);

create index return_requests_customer_created_idx
  on public.return_requests(customer_id, created_at desc);

create index return_request_items_order_item_idx
  on public.return_request_items(order_item_id);

alter table public.return_requests enable row level security;
alter table public.return_request_items enable row level security;

revoke all on table public.return_requests from anon, authenticated;
revoke all on table public.return_request_items from anon, authenticated;
grant select on table public.return_requests to authenticated;
grant select on table public.return_request_items to authenticated;

create policy return_requests_read
on public.return_requests
for select
to authenticated
using (customer_id = (select auth.uid()) or (select private.is_admin()));

create policy return_request_items_read
on public.return_request_items
for select
to authenticated
using (
  exists (
    select 1
    from public.return_requests r
    where r.id = return_request_id
      and (r.customer_id = (select auth.uid()) or (select private.is_admin()))
  )
);

create function public.customer_create_return_request(
  p_order_id uuid,
  p_request_type text,
  p_reason text,
  p_details text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  o public.orders%rowtype;
  result_id uuid;
  entry jsonb;
  item_id uuid;
  item_quantity integer;
  ordered_quantity integer;
begin
  if actor_id is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  if p_request_type not in ('return','refund') then
    raise exception 'Choose a valid request type' using errcode='22023';
  end if;

  if p_reason not in ('wrong_size','damaged','not_as_described','changed_mind','duplicate_order','other') then
    raise exception 'Choose a valid reason' using errcode='22023';
  end if;

  if char_length(coalesce(p_details,'')) > 2000 then
    raise exception 'Request details are too long' using errcode='22023';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 50 then
    raise exception 'Choose at least one order item' using errcode='22023';
  end if;

  select * into o
  from public.orders
  where id = p_order_id
  for update;

  if not found or o.customer_id is distinct from actor_id then
    raise exception 'Order unavailable' using errcode='42501';
  end if;

  if o.is_test then
    raise exception 'Test orders cannot create return requests' using errcode='22023';
  end if;

  if o.payment_status not in ('paid','partially_refunded') then
    raise exception 'Payment must be confirmed before a return or refund can be requested' using errcode='22023';
  end if;

  if o.fulfillment_status in ('cancelled','returned') then
    raise exception 'This order is no longer eligible for a return request' using errcode='22023';
  end if;

  if exists (
    select 1
    from public.return_requests
    where order_id = p_order_id
      and status in ('requested','under_review','approved')
  ) then
    raise exception 'An active request already exists for this order' using errcode='23505';
  end if;

  insert into public.return_requests(
    order_id,
    customer_id,
    request_type,
    reason,
    details
  ) values (
    p_order_id,
    actor_id,
    p_request_type,
    p_reason,
    coalesce(p_details,'')
  ) returning id into result_id;

  for entry in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(entry) <> 'object'
       or entry->>'order_item_id' is null
       or entry->>'quantity' is null then
      raise exception 'Invalid return item' using errcode='22023';
    end if;

    begin
      item_id := (entry->>'order_item_id')::uuid;
      item_quantity := (entry->>'quantity')::integer;
    exception when invalid_text_representation then
      raise exception 'Invalid return item' using errcode='22023';
    end;

    select quantity into ordered_quantity
    from public.order_items
    where id = item_id and order_id = p_order_id;

    if not found or item_quantity < 1 or item_quantity > ordered_quantity then
      raise exception 'Invalid return quantity' using errcode='22023';
    end if;

    if exists (
      select 1 from public.return_request_items
      where return_request_id = result_id and order_item_id = item_id
    ) then
      raise exception 'Duplicate return item' using errcode='22023';
    end if;

    insert into public.return_request_items(return_request_id, order_item_id, quantity)
    values(result_id, item_id, item_quantity);
  end loop;

  return result_id;
end
$$;

revoke all on function public.customer_create_return_request(uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.customer_create_return_request(uuid,text,text,text,jsonb) to authenticated;

create function public.admin_update_return_request(
  p_request_id uuid,
  p_expected_updated_at timestamptz,
  p_status text,
  p_admin_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_request public.return_requests%rowtype;
begin
  if not private.is_admin() then
    raise exception 'Forbidden' using errcode='42501';
  end if;

  if p_status not in ('requested','under_review','approved','rejected','resolved') then
    raise exception 'Invalid return status' using errcode='22023';
  end if;

  if char_length(coalesce(p_admin_note,'')) > 2000 then
    raise exception 'Admin note is too long' using errcode='22023';
  end if;

  select * into current_request
  from public.return_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Return request unavailable' using errcode='22023';
  end if;

  if current_request.updated_at is distinct from p_expected_updated_at then
    raise exception 'Return request changed' using errcode='40001';
  end if;

  if p_status <> current_request.status and not (
    (current_request.status = 'requested' and p_status in ('under_review','approved','rejected'))
    or (current_request.status = 'under_review' and p_status in ('approved','rejected'))
    or (current_request.status = 'approved' and p_status = 'resolved')
  ) then
    raise exception 'Invalid return status transition' using errcode='22023';
  end if;

  update public.return_requests
  set status = p_status,
      admin_note = coalesce(p_admin_note,''),
      updated_at = now()
  where id = p_request_id;

  return p_request_id;
end
$$;

revoke all on function public.admin_update_return_request(uuid,timestamptz,text,text) from public,anon;
grant execute on function public.admin_update_return_request(uuid,timestamptz,text,text) to authenticated;

commit;
