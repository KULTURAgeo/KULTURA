-- KULTURA category division assignment. Legacy rows stay NULL until assigned.
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS audience text;
ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_audience_check;
ALTER TABLE public.categories
  ADD CONSTRAINT categories_audience_check
  CHECK (audience IS NULL OR audience IN ('x', 'y', 'unisex'));
COMMENT ON COLUMN public.categories.audience IS
  'Shop division for this category: x, y, unisex. NULL is legacy/unassigned.';
