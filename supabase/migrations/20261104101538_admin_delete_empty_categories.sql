begin;

-- Products must retain a valid category reference; RESTRICT remains the final guard.
grant delete on public.categories to authenticated;

do $migration$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'categories'
      and policyname = 'categories_admin_delete'
  ) then
    create policy categories_admin_delete
    on public.categories
    for delete
    to authenticated
    using ((select private.is_admin()));
  end if;
end
$migration$;

commit;
