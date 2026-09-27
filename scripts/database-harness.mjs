import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
export async function createTestDatabase({ seed = true, phase2Only = false } = {}) {
  const db = new PGlite();
  // Minimal Supabase Auth contract; not a substitute for testing hosted GoTrue/PostgREST.
  await db.exec(`
 create role anon nologin;
 create role authenticated nologin;
 create role service_role nologin bypassrls;
 create schema auth;
 create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
 create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
 $$;
 grant usage on schema auth to anon, authenticated, service_role;
 grant execute on function auth.uid() to anon, authenticated, service_role;
 create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
 alter table storage.objects enable row level security;
 grant usage on schema storage to anon,authenticated,service_role;
 grant select,insert,update,delete on storage.objects to anon,authenticated;
 grant all on storage.objects,storage.buckets to service_role;
 alter default privileges in schema public grant all on tables to anon, authenticated;
 `);
  for (const file of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql") && (!phase2Only || f.startsWith("20260923")))
    .sort()) {
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  }
  if (seed) await db.exec(await readFile("supabase/seed.sql", "utf8"));
  return db;
}
