// Evidence probe, not a passing CI gate: reports confirmed gaps in current main.
// All writes are confined to a fresh in-memory PostgreSQL instance.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { createTestDatabase } from "./database-harness.mjs";
const db = await createTestDatabase();
const a = "10000000-0000-4000-8000-000000000001", b = "10000000-0000-4000-8000-000000000002";
const evidence = [];
async function as(user, callback) {
  await db.exec("begin; set local role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[user]);
  try { const result = await callback(); await db.exec("commit"); return result; }
  catch(error) { await db.exec("rollback"); throw error; }
}
try {
  await db.query("insert into auth.users(id,email) values($1,'a@example.invalid'),($2,'b@example.invalid')",[a,b]);
  const variant=(await db.query("select v.id,v.product_id,p.price from product_variants v join products p on p.id=v.product_id where p.status='active' and v.is_active and v.stock_quantity>=3 limit 1")).rows[0];
  const cart=JSON.stringify([{product_id:variant.product_id,variant_id:variant.id,quantity:3,price:1,final_total:1}]);
  const address=JSON.stringify({recipient_name:'Disposable audit',phone:'000000000',city:'Tbilisi',address_line_1:'TEST ONLY DO NOT SHIP',country_code:'GE'});
  const create=()=>db.query("select checkout_create_unpaid_order($1::jsonb,$2::jsonb,null) id",[cart,address]).then(r=>r.rows[0].id);
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
  const notification=await as(a,()=>db.query("select notification_prepare($1,'payment_paid') value",[orderId]).then(r=>r.rows[0].value));
  evidence.push({status:'FAILED',check:'Customer cannot prepare payment-paid event for pending order',actual:'RPC accepted payment_paid; no email or SMS sent by this probe'});
  await as(a,()=>db.query("select notification_record_delivery($1,'email','sent')",[notification.id]));
  assert.equal((await db.query("select email_status from notification_outbox where id=$1",[notification.id])).rows[0].email_status,'sent');
  evidence.push({status:'FAILED',check:'Customer cannot forge provider delivery receipt',actual:'RPC accepted sent status without provider evidence'});
  await assert.rejects(()=>as(a,()=>db.query("select checkout_create_unpaid_order(null,$1::jsonb,null)",[address])),e=>e.code==='22023');
  await assert.rejects(()=>as(a,()=>db.query("select checkout_create_unpaid_order($1::jsonb,null,null)",[cart])),e=>e.code==='22023');
  evidence.push({status:'PASSED',check:'SQL NULL cart/address rejected by RPC after audit migration'});
  const rls=(await db.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind='r' and not relrowsecurity")).rows;
  assert.deepEqual(rls,[]);evidence.push({status:'PASSED',check:'Every public table has RLS enabled'});
  const definer=(await db.query("select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and prosecdef and not coalesce(proconfig @> array['search_path=\"\"'],false)")).rows;
  evidence.push({status:definer.length?'FAILED':'PASSED',check:'Security definers pin empty search_path',functions:definer.map(r=>r.proname)});
  const result={scope:'Isolated PGlite; baseline application migrations only; no hosted connection, payment or notification send',evidence};
  await writeFile('qa/master-database-boundary-audit.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
  if (evidence.some(check=>check.status==='FAILED')) process.exitCode=1;
} finally { await db.close(); }
