import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createTestDatabase } from "./database-harness.mjs";
const db = await createTestDatabase({seed:false});
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
