begin;
create function public.customer_save_address(p_id uuid,p_address jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare result_id uuid; owner_id uuid := auth.uid();
begin
if owner_id is null then raise exception 'Sign in required' using errcode='42501'; end if;
-- Serialize default-address changes for this customer.
perform 1 from public.profiles where id=owner_id for update;
if not found then raise exception 'Profile unavailable' using errcode='42501'; end if;
if (p_address->>'is_default')::boolean then update public.addresses set is_default=false where profile_id=owner_id; end if;
if p_id is null then
insert into public.addresses(recipient_name,phone,country_code,city,address_line_1,address_line_2,postal_code,is_default)
values(p_address->>'recipient_name',p_address->>'phone',p_address->>'country_code',p_address->>'city',p_address->>'address_line_1',p_address->>'address_line_2',p_address->>'postal_code',(p_address->>'is_default')::boolean) returning id into result_id;
else
update public.addresses set recipient_name=p_address->>'recipient_name',phone=p_address->>'phone',country_code=p_address->>'country_code',city=p_address->>'city',address_line_1=p_address->>'address_line_1',address_line_2=p_address->>'address_line_2',postal_code=p_address->>'postal_code',is_default=(p_address->>'is_default')::boolean where id=p_id and profile_id=owner_id returning id into result_id;
if result_id is null then raise exception 'Address unavailable' using errcode='42501'; end if;
end if;
return result_id;
end $$;
revoke all on function public.customer_save_address(uuid,jsonb) from public,anon;
grant execute on function public.customer_save_address(uuid,jsonb) to authenticated;
commit;
