-- Forward repair of the two observed staging definitions. Does not replay bootstrap.
-- No row writes, grants, ownership changes, table changes or historical edits.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $repair$
declare
  target record;
  source text;
  definition text;
  original_acl aclitem[];
  original_owner oid;
begin
  -- A pre-hardening database (including current production) must refuse this repair.
  if to_regprocedure('public.checkout_submit_order(uuid,jsonb,jsonb,text)') is null then
    raise exception 'Hardened checkout wrapper prerequisite missing';
  end if;
  for target in select * from (values
    ('public.checkout_create_unpaid_order(jsonb,jsonb,text)', '9700e36290f01749bc3e86856df6bfb4', 'd46730dfaa22f994777c3fb9a00e03fa'),
    ('public.notification_record_delivery(uuid,text,text)', 'cdb035b3d176a99fd99c93b0b92fe257', '53a22ce0e9f5d613e1e2a9675bc55adb')
  ) as known(signature,before_hash,after_hash) loop
    select md5(replace(prosrc,chr(13),'')),pg_get_functiondef(oid),proacl,proowner
      into source,definition,original_acl,original_owner
      from pg_proc where oid=to_regprocedure(target.signature)
      and prosecdef and proconfig @> array['search_path=""']
      and prolang=(select oid from pg_language where lanname='plpgsql');
    if source is null or source not in (target.before_hash,target.after_hash) then
      raise exception 'Unrecognized function drift: %',target.signature;
    end if;
    if pg_get_userbyid(original_owner) <> 'postgres' or
       has_function_privilege('anon',target.signature,'EXECUTE') or
       has_function_privilege('authenticated',target.signature,'EXECUTE') then
      raise exception 'Unexpected owner or caller privileges: %',target.signature;
    end if;
    if source=target.before_hash then
      if target.signature like 'public.checkout_create_unpaid_order%' then
        definition := replace(definition,'if jsonb_typeof(p_cart)', 'if p_cart is null or jsonb_typeof(p_cart)');
        definition := replace(definition,'if jsonb_typeof(p_address)', 'if p_address is null or jsonb_typeof(p_address)');
      else
        definition := replace(definition,'  customer uuid;','');
        definition := replace(definition,'if p_channel not in', 'if p_channel is null or p_status is null or p_channel not in');
      end if;
      execute definition;
    end if;
    if not exists(select 1 from pg_proc where oid=to_regprocedure(target.signature)
      and md5(replace(prosrc,chr(13),''))=target.after_hash
      and proowner=original_owner and proacl is not distinct from original_acl) then
      raise exception 'Repair postcondition failed: %',target.signature;
    end if;
  end loop;
end
$repair$;
commit;
