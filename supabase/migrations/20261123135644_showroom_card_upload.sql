begin;

alter table public.homepage_showroom_items
  add column image_path text,
  add constraint showroom_image_path_format check (
    image_path is null or image_path ~ (
      '^showroom/' || id::text || '/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}[.]webp$'
    )
  );

create policy kultura_showroom_images_admin_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'product-images' and (select private.is_admin())
    and name ~ '^showroom/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}[.]webp$'
  );

commit;
