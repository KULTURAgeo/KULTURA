import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTestDatabase} from './database-harness.mjs';
const db=await createTestDatabase({seed:false});
const backup=JSON.parse(await readFile('qa/staging-function-backup-20261015.json','utf8'));
const sql=await readFile('supabase/migrations/20261015201827_repair_staging_checkout_notification_null_guards.sql','utf8');
const snapshot=()=>db.query("select oid::regprocedure::text signature,prosrc,proacl,proowner from pg_proc where proname in ('checkout_create_unpaid_order','notification_record_delivery') order by 1").then(r=>r.rows);
try {
  // Reconstruct only the exact observed staging drift; existing hardened ACLs stay.
  for(const f of backup.functions) await db.exec(f.definition);
  const acl=(await snapshot()).map(f=>f.proacl);
  await db.exec(sql);
  const repaired=await snapshot();
  assert.deepEqual(repaired.map(f=>f.proacl),acl);
  await db.exec(sql);assert.deepEqual(await snapshot(),repaired);
  await db.exec("create or replace function public.notification_record_delivery(p_notification_id uuid,p_channel text,p_status text) returns void language plpgsql security definer set search_path='' as $$begin raise exception 'Unknown fixture';end$$");
  const unknown=await snapshot();
  await assert.rejects(()=>db.exec(sql),/Unrecognized function drift/);await db.exec('rollback');
  assert.deepEqual(await snapshot(),unknown);
  // First function repair must also roll back when the second has unknown drift.
  await db.exec(backup.functions.find(f=>f.signature.startsWith('checkout_')).definition);
  const partial=await snapshot();
  await assert.rejects(()=>db.exec(sql),/Unrecognized function drift/);await db.exec('rollback');
  assert.deepEqual(await snapshot(),partial);
  console.log('4 staging repair checks passed: exact known drift repaired preserving ACL, repeat safe, unknown refused, atomic rollback');
}finally{await db.close();}
