begin;

-- Products retain their category reference, including for historical orders.
-- The existing ON DELETE RESTRICT foreign key remains the final safety guard.
grant delete on public.categories to authenticated;
create policy categories_admin_delete
on public.categories
for delete
to authenticated
using ((select private.is_admin()));

commit;
