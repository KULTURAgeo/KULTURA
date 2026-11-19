-- Keep existing policies, privileges and RPC entry points, and tighten their shared guard.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal' = 'aal2', false)
    and exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    );
$$;

