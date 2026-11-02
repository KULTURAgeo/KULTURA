import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createTestDatabase} from './database-harness.mjs';
const baseline={through:'20261015201827_repair_staging_checkout_notification_null_guards.sql'};
const db=await createTestDatabase(baseline);
const checks=[];
const a='e18a0000-0000-4000-8000-000000000001';
const b='e18a0000-0000-4000-8000-000000000002';
const address={recipient_name:'LOCAL ONLY',phone:'000000000',city:'Tbilisi',address_line_1:'DO NOT SHIP'};
const patch=await readFile('supabase/migrations/20261017211555_checkout_stock_promo_reservations.sql','utf8');
async function check(name,fn){await fn();checks.push(name);}
async function submit(user,key,promo=null,quantity=2){
  await db.exec('begin; set local role authenticated');
  try{
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);
    const result=await db.query('select public.checkout_submit_order($1,$2::jsonb,$3::jsonb,$4) id',[key,JSON.stringify([{product_id:variant.product_id,variant_id:variant.id,quantity}]),JSON.stringify(address),promo]);
    await db.exec('commit'); return result.rows[0].id;
  }catch(e){await db.exec('rollback');throw e;}
}
let variant;
const stock=async()=>(await db.query('select stock_quantity from product_variants where id=$1',[variant.id])).rows[0].stock_quantity;
const uses=async()=>(await db.query("select used_count from promo_codes where code='RESERVE30'")).rows[0].used_count;
try{
 await db.exec(patch);
 await db.query("insert into auth.users(id,email) values($1,'reserve-a@example.invalid'),($2,'reserve-b@example.invalid')",[a,b]);
 variant=(await db.query("select v.id,v.product_id from product_variants v join products p on p.id=v.product_id where p.status='active' and v.is_active order by v.id limit 1")).rows[0];
 await db.query('update product_variants set stock_quantity=3 where id=$1',[variant.id]);
 await db.exec("insert into promo_codes(code,kind,amount,currency,max_uses,is_active) values('RESERVE30','fixed',100,'GEL',1,true)");
 const key='e18a0000-0000-4000-8000-000000000003';
 const first=await submit(a,key,'RESERVE30');
 await check('New unpaid order holds stock and one promo use for 30 minutes',async()=>{
  assert.equal(await stock(),1);assert.equal(await uses(),1);
  const r=(await db.query("select r.state,extract(epoch from r.expires_at-o.created_at) seconds,o.payment_status from private.checkout_reservations r join orders o on o.id=r.order_id where o.id=$1",[first])).rows[0];
  assert.equal(r.state,'held');assert.equal(r.payment_status,'pending');assert.ok(+r.seconds>=1800&&+r.seconds<1810);
 });
 await check('Idempotent replay does not deduct twice',async()=>{assert.equal(await submit(a,key,'RESERVE30'),first);assert.equal(await stock(),1);assert.equal(await uses(),1);});
 await check('Other customer cannot oversell held stock',()=>assert.rejects(submit(b,crypto.randomUUID()),/Insufficient stock/));
 await check('Other customer cannot consume a reserved promo slot',()=>assert.rejects(submit(b,crypto.randomUUID(),'RESERVE30',1),/Promo code unavailable/));
 await check('Expiry restores exact inventory and promo slot once',async()=>{
  await db.query("update private.checkout_reservations set expires_at=clock_timestamp()-interval '1 second' where order_id=$1",[first]);
  assert.equal((await db.query('select private.expire_checkout_reservations(100) n')).rows[0].n,1);
  assert.equal(await stock(),3);assert.equal(await uses(),0);
  assert.equal((await db.query('select private.expire_checkout_reservations(100) n')).rows[0].n,0);
  assert.equal((await db.query('select payment_status from orders where id=$1',[first])).rows[0].payment_status,'cancelled');
 });
 await check('Expired retry returns old cancelled order, not a hidden new purchase',async()=>assert.equal(await submit(a,key,'RESERVE30'),first));
 await check('Late payment cannot consume a released reservation',()=>assert.rejects(db.query("update orders set payment_status='paid',paid_at=now() where id=$1",[first]),/requires reconciliation/));
 const paid=await submit(b,crypto.randomUUID(),'RESERVE30');
 await check('Trusted payment consumes reservation without double deduction',async()=>{
  await db.query("update orders set payment_status='paid',paid_at=now() where id=$1",[paid]);
  assert.equal(await stock(),1);assert.equal(await uses(),1);
  await db.query("update private.checkout_reservations set expires_at=clock_timestamp()-interval '1 second' where order_id=$1",[paid]);
  assert.equal((await db.query('select private.expire_checkout_reservations(100) n')).rows[0].n,0);
 });
 await check('Refund does not automatically restock uninspected goods or reuse paid promo',async()=>{
  await db.query("update orders set payment_status='refunded' where id=$1",[paid]);assert.equal(await stock(),1);assert.equal(await uses(),1);
 });
 const cancelled=await submit(a,crypto.randomUUID(),null,1);
 await check('Explicit unpaid cancellation restores stock once',async()=>{
  assert.equal(await stock(),0);await db.query("update orders set fulfillment_status='cancelled' where id=$1",[cancelled]);assert.equal(await stock(),1);
  await db.query("update orders set payment_status='cancelled' where id=$1",[cancelled]);assert.equal(await stock(),1);
 });
 await check('Customers cannot call expiry or mutate reservation ledger',async()=>{
  for(const sql of ['select private.expire_checkout_reservations(100)','select * from private.checkout_reservations']){
   await db.exec('begin;set local role authenticated');await assert.rejects(db.exec(sql),e=>e.code==='42501');await db.exec('rollback');
  }
 });
 await check('Payment after deadline is denied even before expiry worker runs',async()=>{
  const pending=await submit(a,crypto.randomUUID(),null,1);
  await db.query("update private.checkout_reservations set expires_at=clock_timestamp()-interval '1 second' where order_id=$1",[pending]);
  await assert.rejects(db.query("update orders set payment_status='paid',paid_at=now() where id=$1",[pending]),/requires reconciliation/);
  assert.equal((await db.query('select private.expire_checkout_reservations(100) n')).rows[0].n,1);
  assert.equal(await stock(),1);
 });
 await check('Failure releases new hold and failed orders cannot resurrect payment',async()=>{
  const failed=await submit(a,crypto.randomUUID(),null,1);
  await db.query("update orders set payment_status='failed' where id=$1",[failed]);assert.equal(await stock(),1);
  await assert.rejects(db.query("update orders set payment_status='pending' where id=$1",[failed]),/cannot become pending/);
 });
 await check('Invalid expiry batch refused',async()=>{for(const limit of [null,0,101])await assert.rejects(db.query('select private.expire_checkout_reservations($1)',[limit]),/Invalid batch/);});
 await check('Patch refuses reapplication atomically instead of overwriting accounting',async()=>{await assert.rejects(db.exec(patch),/already exist/);await db.exec('rollback');assert.equal(await stock(),1);});
}finally{await db.close();}
const historical=await createTestDatabase(baseline);
try{
 await historical.exec("insert into orders(subtotal,final_total,customer_email,delivery_name,delivery_phone,delivery_country_code,delivery_city,delivery_address_line_1,promo_code_snapshot) values(100,100,'old@example.invalid','OLD','000','GE','Tbilisi','OLD','HISTORICAL')");
 const before=(await historical.query('select * from orders')).rows;
 const counters=(await historical.query('select id,used_count from promo_codes order by id')).rows;
 await historical.exec(patch);
 assert.deepEqual((await historical.query('select * from orders')).rows,before);
 assert.deepEqual((await historical.query('select id,used_count from promo_codes order by id')).rows,counters);
 assert.equal((await historical.query('select count(*)::integer n from private.checkout_reservations')).rows[0].n,0);
 checks.push('Historical orders and promo counters unchanged; no inferred reservations');
}finally{await historical.close();}
const drift=await createTestDatabase(baseline);
try{
 await drift.exec("create or replace function public.checkout_submit_order(p_request_id uuid,p_cart jsonb,p_address jsonb,p_promo_code text) returns uuid language sql as $$select null::uuid$$");
 await assert.rejects(drift.exec(patch),/Unknown checkout accounting baseline/);
 await drift.exec('rollback');
 assert.equal((await drift.query("select to_regclass('private.checkout_reservations') value")).rows[0].value,null);
 checks.push('Unknown checkout body refused before DDL; no partial ledger');
}finally{await drift.close();}
await writeFile('qa/checkout-reservation-results.json',JSON.stringify({scope:'Disposable local PGlite; SQL auth shim, no hosted writes or payments',passed:checks.length,checks},null,2)+'\n');
console.log(`${checks.length} reservation checks passed`);
