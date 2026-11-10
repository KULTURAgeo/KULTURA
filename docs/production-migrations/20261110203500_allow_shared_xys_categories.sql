-- XYS makes one category reusable across X, Y, and UNISEX. Products remain assigned to exactly one division.
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_audience_check;
ALTER TABLE public.categories ADD CONSTRAINT categories_audience_check
  CHECK (audience IS NULL OR audience IN ('x','y','unisex','xys'));
COMMENT ON COLUMN public.categories.audience IS
  'x=women, y=men, unisex=unisex only, xys=shared category across all 3; does not share products.';
