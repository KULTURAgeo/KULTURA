alter table public.product_images
  add column color_id uuid,
  add constraint product_images_product_color_fkey
    foreign key (color_id, product_id) references public.product_colors (id, product_id)
    on delete set null (color_id);

create index product_images_color_idx on public.product_images (color_id, product_id)
  where color_id is not null;
