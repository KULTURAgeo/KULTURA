// Executable security boundary gate; any assertion failure exits nonzero.
// All writes are confined to a fresh in-memory PostgreSQL instance.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { createTestDatabase } from "./database-harness.mjs";
const db = await createTestDatabase();
const a = "10000000-0000-4000-8000-000000000001", b = "10000000-0000-4000-8000-000000000002";
const evidence = [];
async function as(user, callback, role = "authenticated") {
  await db.exec("begin; set local role " + role);
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user ?? ""]);
  try { const result = await callback(); await db.exec("commit"); return result; }
  catch(error) { await db.exec("rollback"); throw error; }
}
try {
  await db.query("insert into auth.users(id,email) values($1,'a@example.invalid'),($2,'b@example.invalid')",[a,b]);
  const variant=(await db.query("select v.id,v.product_id,p.price from product_variants v join products p on p.id=v.product_id where p.status='active' and v.is_active and v.stock_quantity>=3 limit 1")).rows[0];
  const cart=JSON.stringify([{product_id:variant.product_id,variant_id:variant.id,quantity:3}]);
  const address=JSON.stringify({recipient_name:'Disposable audit',phone:'000000000',city:'Tbilisi',address_line_1:'TEST ONLY DO NOT SHIP'});
  const requestId="20000000-0000-4000-8000-000000000001";
  const create=()=>db.query("select checkout_submit_order($1,$2::jsonb,$3::jsonb,null) id",[requestId,cart,address]).then(r=>r.rows[0].id);
  const orderId=await as(a,create);
  const order=(await db.query("select * from orders where id=$1",[orderId])).rows[0];
  assert.equal(order.subtotal,variant.price*3);assert.equal(order.final_total,order.subtotal);assert.equal(order.payment_status,'pending');
  assert.equal((await db.query("select quantity from order_items where order_id=$1",[orderId])).rows[0].quantity,3);
  evidence.push({status:'PASSED',check:'Unpaid checkout uses DB price, selected quantity, shipping and pending payment'});
  await as(b,async()=>{for(const table of ['orders','order_items'])assert.equal((await db.query(`select * from ${table} where ${table==='orders'?'id':'order_id'}=$1`,[orderId])).rows.length,0)});
  evidence.push({status:'PASSED',check:'Customer B cannot select Customer A order or items through RLS'});
  await assert.rejects(()=>as(b,()=>db.query("select notification_prepare($1,'order_received')",[orderId])),e=>e.code==='42501');
  evidence.push({status:'PASSED',check:'Customer B cannot prepare Customer A notification'});
  const repeated=await as(a,create);
  evidence.push({status:repeated===orderId?'PASSED':'FAILED',check:'Identical retried submission returns same order',actual:repeated===orderId?'same order':'second distinct pending order'});
  await assert.rejects(()=>as(a,()=>db.query("select notification_prepare($1,'payment_paid')",[orderId])),e=>e.code==='42501');
  evidence.push({status:'PASSED',check:'Customer cannot prepare payment-paid event'});
  await assert.rejects(()=>as(null,()=>db.query("select notification_prepare($1,'payment_paid')",[orderId]),'service_role'),e=>e.code==='22023');
  evidence.push({status:'PASSED',check:'Trusted backend cannot prepare paid event for unpaid order'});
  const notification=(await db.query("select id from notification_outbox where order_id=$1 and event_type='order_received'",[orderId])).rows[0];
  assert.ok(notification);
  evidence.push({status:'PASSED',check:'Order-received notification queued atomically without sending'});
  await assert.rejects(()=>as(a,()=>db.query("select notification_record_delivery($1,'email','sent')",[notification.id])),e=>e.code==='42501');
  evidence.push({status:'PASSED',check:'Customer cannot forge delivery receipt'});
  await assert.rejects(()=>as(a,()=>db.query("select notification_claim($1,'email')",[notification.id])),e=>e.code==='42501');
  evidence.push({status:'PASSED',check:'Customer cannot claim backend delivery work'});
  await as(null,async()=>{
    assert.equal((await db.query("select notification_claim($1,'email') claimed",[notification.id])).rows[0].claimed,true);
    assert.equal((await db.query("select notification_claim($1,'email') claimed",[notification.id])).rows[0].claimed,false);
    await db.query("select notification_record_delivery($1,'email','sent')",[notification.id]);
  },'service_role');
  evidence.push({status:'PASSED',check:'Trusted backend claims once and records result (simulated delivery only)'});
  await assert.rejects(()=>as(a,()=>db.query("select checkout_create_unpaid_order($1::jsonb,$2::jsonb,null)",[cart,address])),e=>e.code==='42501');
  evidence.push({status:'PASSED',check:'Legacy non-idempotent checkout RPC denied'});
  await assert.rejects(()=>as(a,()=>db.query("select checkout_submit_order($1,null,$2::jsonb,null)",[requestId,address])),e=>e.code==='22023');
  await assert.rejects(()=>as(a,()=>db.query("select checkout_submit_order($1,$2::jsonb,null,null)",[requestId,cart])),e=>e.code==='22023');
  evidence.push({status:'PASSED',check:'NULL cart/address denied'});
  const changed=JSON.stringify([{product_id:variant.product_id,variant_id:variant.id,quantity:2}]);
  await assert.rejects(()=>as(a,()=>db.query("select checkout_submit_order($1,$2::jsonb,$3::jsonb,null)",[requestId,changed,address])),e=>e.code==='22023');
  evidence.push({status:'PASSED',check:'Same key conflicting quantity rejected'});
  const forged=JSON.stringify([{product_id:variant.product_id,variant_id:variant.id,quantity:3,price:1}]);
  await assert.rejects(()=>as(a,()=>db.query("select checkout_submit_order($1,$2::jsonb,$3::jsonb,null)",[requestId,forged,address])),e=>e.code==='22023');
  evidence.push({status:'PASSED',check:'Client price fields rejected at SQL boundary'});
  const otherId=await as(b,create); assert.notEqual(otherId,orderId);
  evidence.push({status:'PASSED',check:'Idempotency key is scoped to authenticated customer'});
  await db.query("insert into promo_codes(code,kind,amount,max_uses,is_active) values('AUDIT10','percentage',1000,1,true)");
  const promoCreate=()=>db.query("select checkout_submit_order('20000000-0000-4000-8000-000000000002',$1::jsonb,$2::jsonb,'AUDIT10') id",[cart,address]).then(r=>r.rows[0].id);
  const promoOrder=await as(a,promoCreate);assert.equal(await as(a,promoCreate),promoOrder);
  assert.equal((await db.query("select used_count from promo_codes where code='AUDIT10'")).rows[0].used_count,1);
  assert.equal((await db.query("select discount_total from orders where id=$1",[promoOrder])).rows[0].discount_total,Math.floor(variant.price*3/10));
  evidence.push({status:'PASSED',check:'Promo price calculated in SQL and replay consumes exactly one use'});
  await as(null,()=>db.query("update orders set payment_status='paid' where id=$1",[orderId]),'service_role');
  await as(null,()=>db.query("select notification_prepare($1,'payment_paid')",[orderId]),'service_role');
  evidence.push({status:'PASSED',check:'Verified backend state transition can queue future payment success event'});
  await assert.rejects(()=>as(null,create,'anon'),e=>e.code==='42501');
  evidence.push({status:'PASSED',check:'Anonymous direct checkout RPC denied'});
  await db.query("update profiles set role='admin' where id=$1",[b]);
  await assert.rejects(()=>as(b,()=>db.query("select notification_record_delivery($1,'email','sent')",[notification.id])),e=>e.code==='42501');
  evidence.push({status:'PASSED',check:'Admin session cannot forge backend notification delivery either'});
  await assert.rejects(()=>as(null,()=>db.query("select notification_record_delivery($1,null,'sent')",[notification.id]),'service_role'),e=>e.code==='22023');
  evidence.push({status:'PASSED',check:'Trusted delivery API rejects NULL channel'});
  await db.query("update private.request_limits set attempts=10 where customer_id=$1 and scope='checkout'",[a]);
  assert.equal(await as(a,create),orderId);
  await assert.rejects(()=>as(a,()=>db.query("select checkout_submit_order('20000000-0000-4000-8000-000000000009',$1::jsonb,$2::jsonb,null)",[cart,address])),e=>e.code==='PT429');
  evidence.push({status:'PASSED',check:'Bounded SQL quota blocks new orders but allows existing request replay'});
  const rls=(await db.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r' and not relrowsecurity")).rows;
  assert.deepEqual(rls,[]);evidence.push({status:'PASSED',check:'Every public table has RLS enabled'});
  const definer=(await db.query("select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and prosecdef and not coalesce(proconfig @> array['search_path=\"\"'],false)")).rows;
  evidence.push({status:definer.length?'FAILED':'PASSED',check:'Security definers pin empty search_path',functions:definer.map(r=>r.proname)});
  const result={scope:'Isolated PGlite; repository migrations including remediation; no hosted connection, payment or notification send',evidence};
  await writeFile('qa/master-database-boundary-audit.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
  if (evidence.some(check=>check.status==='FAILED')) process.exitCode=1;
} finally { await db.close(); }
