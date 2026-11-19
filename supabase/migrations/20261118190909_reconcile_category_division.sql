begin;

-- The deployed catalog already uses this column. Keep fresh local databases aligned.
alter table public.categories add column if not exists audience text;
alter table public.categories drop constraint if exists categories_audience_check;
alter table public.categories add constraint categories_audience_check
  check (audience is null or audience in ('x', 'y', 'unisex', 'xys'));
comment on column public.categories.audience is
  'x=women, y=men, unisex=unisex only, xys=shared category across all 3; does not share products.';

commit;
