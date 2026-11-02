import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createTestDatabase} from './database-harness.mjs';
const db=await createTestDatabase({through:'20261017211555_checkout_stock_promo_reservations.sql'});
const sql=await readFile('supabase/migrations/20261018111916_reconcile_security_controls.sql','utf8');
const checks=[];
const customer='e0180000-0000-4000-8000-000000000001';
const check=async(name,fn)=>{await fn();checks.push(name);};
const snapshot=async()=> (await db.query("select oid::regprocedure::text signature,prosrc,proacl,proowner from pg_proc where pronamespace in ('public'::regnamespace,'private'::regnamespace) order by 1")).rows;
async function asCustomer(query,args=[]){
 await db.exec('begin;set local role authenticated');
 try {await db.query("select set_config('request.jwt.claim.sub',$1,true)",[customer]);return await db.query(query,args);}
 finally {await db.exec('rollback');}
}
try {
 const before=await snapshot();
 const totals=async()=>(await db.query('select (select sum(stock_quantity) from product_variants) stock,(select sum(used_count) from promo_codes) promos,(select count(*) from orders) orders')).rows;
 const counts=await totals();
 await db.exec(sql);
 await check('Reconciliation preserves existing inventory, promo counts and orders',async()=>assert.deepEqual(await totals(),counts));
 await check('Existing public function owners and ACLs remain unchanged',async()=>{
  const after=await snapshot();for(const f of before.filter(f=>!f.signature.startsWith('private.'))){const actual=after.find(a=>a.signature===f.signature);assert.equal(actual.proowner,f.proowner);assert.deepEqual(actual.proacl,f.proacl);}
 });
 await check('Repeat is idempotent',async()=>{const before=await snapshot();await db.exec(sql);assert.deepEqual(await snapshot(),before);});
 await check('New test checkout is disabled by default',async()=>assert.equal((await db.query('select test_checkout_enabled from private.checkout_settings')).rows[0].test_checkout_enabled,false));
 await db.query("insert into auth.users(id,email) values($1,'reconcile@example.invalid')",[customer]);
 await check('Unexpected customer address fields rejected',()=>assert.rejects(asCustomer("select customer_save_address(null,$1::jsonb)",[JSON.stringify({role:'admin'})]),e=>e.code==='22023'));
 await check('Normal customer still denied admin promo mutation',()=>assert.rejects(asCustomer("select admin_save_promo(null,null,'{}'::jsonb)"),e=>e.code==='42501'));
 await check('Customer cannot execute internal quota trigger',()=>assert.rejects(asCustomer('select private.limit_customer_writes()'),e=>e.code==='42501'));
 for(const [scope,attempts] of [['promo',60],['returns',20],['profile-data',300]])await db.query('insert into private.request_limits(customer_id,scope,window_start,attempts) values($1,$2,clock_timestamp(),$3)',[customer,scope,attempts]);
 await check('Promo quota remains fail-closed',()=>assert.rejects(asCustomer("select checkout_quote_promo('NONE',100)"),e=>e.code==='PT429'));
 await check('Return quota remains fail-closed',()=>assert.rejects(asCustomer("select customer_create_return_request(null,'return','other','','[]')"),e=>e.code==='PT429'));
 await check('Direct profile mutation cannot bypass database quota',()=>assert.rejects(asCustomer("update profiles set full_name='TEST' where id=$1",[customer]),e=>e.code==='PT429'));
 await db.exec("create or replace function private.guard_test_order() returns trigger language plpgsql security definer set search_path='' as $$begin raise exception 'unknown fixture'; end$$");
 const unknown=await snapshot();
 await check('Unknown function refuses entire reconciliation without overwriting it',async()=>{await assert.rejects(db.exec(sql),/Unreviewed function/);await db.exec('rollback');assert.deepEqual(await snapshot(),unknown);});
 await writeFile('qa/security-reconciliation-results.json',JSON.stringify({scope:'These assertions execute only in disposable local PostgreSQL; hosted migration verified separately',passed:checks.length,checks},null,2)+'\n');
 console.log(`${checks.length} security reconciliation checks passed`);
} finally {await db.close();}
