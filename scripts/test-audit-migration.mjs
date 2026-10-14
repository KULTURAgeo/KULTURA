import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createTestDatabase } from "./database-harness.mjs";
const db = await createTestDatabase({seed:false,through:"20261012000100_checkout_null_inputs.sql"});
try {
  const sql=await readFile('supabase/migrations/20261012000100_checkout_null_inputs.sql','utf8');
  const definition=()=>db.query("select prosrc,proacl from pg_proc where oid='public.checkout_create_unpaid_order(jsonb,jsonb,text)'::regprocedure").then(r=>r.rows[0]);
  const before=await definition();
  await db.exec(sql);
  assert.deepEqual(await definition(),before);
  await db.exec("create or replace function public.checkout_create_unpaid_order(p_cart jsonb,p_address jsonb,p_promo_code text) returns uuid language plpgsql security definer set search_path='' as $$begin raise exception 'hardened fixture'; end$$");
  const divergent=await definition();
  await assert.rejects(()=>db.exec(sql),/differs from reviewed baseline/);
  await db.exec('rollback');
  assert.deepEqual(await definition(),divergent);
  console.log('2 migration checks passed: idempotent reapply; divergent function/ACL preserved on refusal');
} finally { await db.close(); }

const secured = await createTestDatabase({seed:false});
try {
  const sql = await readFile('supabase/migrations/20261013000100_checkout_notification_security.sql','utf8');
  const snapshot = () => secured.query("select oid::regprocedure::text signature,prosrc,proacl from pg_proc where pronamespace in ('public'::regnamespace,'private'::regnamespace) order by 1").then(r=>r.rows);
  const before = await snapshot();
  await secured.exec(sql);
  assert.deepEqual(await snapshot(),before);
  assert.equal((await secured.query("select has_function_privilege('authenticated','public.checkout_create_unpaid_order(jsonb,jsonb,text)','EXECUTE') allowed")).rows[0].allowed,false);
  await secured.exec("create or replace function public.notification_claim(p_notification_id uuid,p_channel text) returns boolean language sql as $$select false$$");
  const drift = await snapshot();
  await assert.rejects(()=>secured.exec(sql),/differs from reviewed baseline/);
  await secured.exec('rollback');
  assert.deepEqual(await snapshot(),drift);
  console.log('3 security migration checks passed: idempotent reapply; legacy ACL remains revoked; unknown function rejected atomically');
} finally { await secured.close(); }
