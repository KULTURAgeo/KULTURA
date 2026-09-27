begin;
-- Existing objects remain available. New uploads fit within Vercel request limits.
update storage.buckets set file_size_limit = 3145728 where id = 'product-images';
commit;
