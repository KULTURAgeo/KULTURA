-- Read-only checks after 20261007000100_security_hardening.sql.
-- Every returned row should have passed=true. Run as the SQL Editor owner.
select 'public RLS:'||c.relname as check_name,c.relrowsecurity as passed
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
union all
select 'private RLS:'||c.relname,c.relrowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='private' and c.relkind='r'
union all
select 'legacy checkout unavailable to customer',not has_function_privilege('authenticated','public.checkout_create_unpaid_order(jsonb,jsonb,text)','EXECUTE')
union all
select 'checkout wrapper available to customer',has_function_privilege('authenticated','public.checkout_submit_order(uuid,jsonb,jsonb,text)','EXECUTE')
union all
select 'anonymous checkout denied',not has_function_privilege('anon','public.checkout_submit_order(uuid,jsonb,jsonb,text)','EXECUTE')
union all
select 'customer notification prepare denied',not has_function_privilege('authenticated','public.notification_prepare(uuid,text)','EXECUTE')
union all
select 'customer notification acknowledgement denied',not has_function_privilege('authenticated','public.notification_record_delivery(uuid,text,text)','EXECUTE')
union all
select 'customer notification claim denied',not has_function_privilege('authenticated','public.notification_claim(uuid,text)','EXECUTE')
union all
select 'backend notification delivery allowed',has_function_privilege('service_role','public.notification_prepare(uuid,text)','EXECUTE') and has_function_privilege('service_role','public.notification_claim(uuid,text)','EXECUTE')
union all
select 'customer role update denied',not has_column_privilege('authenticated','public.profiles','role','UPDATE')
union all
select 'customer order payment update denied',not has_column_privilege('authenticated','public.orders','payment_status','UPDATE')
union all
select 'private checkout request reads denied',not has_table_privilege('authenticated','private.checkout_requests','SELECT')
union all
select 'notification queuing trigger',exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='orders_queue_notification' and tgenabled='O')
union all
select 'production sandbox disabled',coalesce((select not test_checkout_enabled from private.checkout_settings where singleton),false)
union all
select 'image bucket limited',exists(select 1 from storage.buckets where id='product-images' and file_size_limit<=3145728 and allowed_mime_types <@ array['image/jpeg','image/png','image/webp']::text[])
order by check_name;
