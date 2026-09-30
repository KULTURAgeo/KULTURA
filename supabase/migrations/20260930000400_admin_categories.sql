begin;

-- Administrators can create and update catalog categories through the app.
-- Deletion stays disabled so products never lose their required category reference.
create policy categories_admin_insert
on public.categories
for insert
to authenticated
with check ((select private.is_admin()));

create policy categories_admin_update
on public.categories
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

grant insert, update on public.categories to authenticated;

commit;
