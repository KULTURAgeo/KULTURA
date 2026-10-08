import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { writeFile, readFile, readdir } from "node:fs/promises";
import { createTestDatabase } from "./database-harness.mjs";
import { checkoutLines, strictForm, strictObject } from "../src/lib/security/input.ts";
import { contentSecurityPolicy } from "../src/lib/security/csp.ts";
import { applicationSegments, unknownRootRoute } from "../src/lib/security/routes.ts";

registerHooks({ resolve(specifier, context, next) {
  if (specifier === "next/headers") return {shortCircuit:true,url:"data:text/javascript,export async function headers(){return globalThis.securityHeaders}; export async function cookies(){return {getAll:()=>[],set(){}}}"};
  if (specifier === "next/cache") return {shortCircuit:true,url:"data:text/javascript,export function revalidatePath(){}"};
  if (specifier === "next/navigation") return {shortCircuit:true,url:"data:text/javascript,export function redirect(){throw new Error('redirect')}"};
  if (specifier === "next/server") return next("next/server.js", context);
  if (specifier.startsWith("@/")) return next(pathToFileURL(resolve("src",specifier.slice(2)+".ts")).href,context);
  return next(specifier, context);
}});
const { rateLimit, RequestError } = await import("../src/lib/security/rate-limit.ts");
const { assertSameOrigin } = await import("../src/lib/security/request.ts");
const { proxy } = await import("../src/proxy.ts");
const { NextRequest } = await import("next/server");
const original = {...process.env}, originalFetch = globalThis.fetch;
const passed = [];
async function check(name, fn) { await fn(); passed.push(name); }
const a="10000000-0000-4000-8000-000000000001", b="10000000-0000-4000-8000-000000000002", admin="10000000-0000-4000-8000-000000000003";
const db = await createTestDatabase();
async function as(who, fn, role="authenticated") {
  await db.exec("begin");
  try {
    await db.exec("set local role "+role);
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[who??""]);
    const result = await fn(); await db.exec("commit"); return result;
  } catch(error) { await db.exec("rollback"); throw error; }
}
const rejected = (fn, code) => assert.rejects(fn,e=>e.code===code);
try {
  await check("Migration verification SQL reports no failures",async()=>{
    const rows=(await db.query(await readFile("supabase/verify-security.sql","utf8"))).rows;
    assert.ok(rows.length>20);assert.deepEqual(rows.filter(r=>!r.passed),[]);
  });
  await check("Route allowlist covers all existing application segments",async()=>{
    const directories=(await readdir("src/app",{withFileTypes:true})).filter(e=>e.isDirectory()&&!e.name.startsWith("[")).map(e=>e.name);
    for(const path of directories)assert.ok(applicationSegments.includes(path),path);
    assert.equal(unknownRootRoute("/constructor"),true);assert.equal(unknownRootRoute("/shop"),false);
  });
  await db.query("insert into auth.users(id,email) values ($1,'a@example.invalid'),($2,'b@example.invalid'),($3,'admin@example.invalid')",[a,b,admin]);
  await db.query("update profiles set role='admin' where id=$1",[admin]);
  const product=(await db.query("select p.* from products p join categories c on c.id=p.category_id where p.status='active' and c.is_active limit 1")).rows[0];
  const variant=(await db.query("select * from product_variants where product_id=$1 and is_active limit 1",[product.id])).rows[0];
  await db.query("update product_variants set stock_quantity=10 where id=$1",[variant.id]);
  const cart=[{product_id:product.id,variant_id:variant.id,quantity:3}];
  const address={recipient_name:"Safe <script>alert(1)</script>",phone:"555000000",city:"Tbilisi",address_line_1:"O'Connor 1",address_line_2:null,postal_code:null};
  const submit=(key,lines=cart,addr=address,promo=null)=>db.query("select checkout_submit_order($1,$2::jsonb,$3::jsonb,$4) id",[key,JSON.stringify(lines),JSON.stringify(addr),promo]);
  let order;
  await check("Anonymous checkout is denied",()=>rejected(()=>as(null,()=>submit(randomUUID()),"anon"),"42501"));
  await check("Legacy checkout cannot bypass wrapper",()=>rejected(()=>as(a,()=>db.query("select checkout_create_unpaid_order($1::jsonb,$2::jsonb,null)",[JSON.stringify(cart),JSON.stringify(address)])),"42501"));
  for(const lines of [null,[],{},[{...cart[0],quantity:0}],[{...cart[0],quantity:-1}],[{...cart[0],quantity:1.5}],[{...cart[0],quantity:100}],[{...cart[0],quantity:1e20}],[{...cart[0],quantity:"2"}],[{...cart[0],price:1}],[{...cart[0],product_id:a}],[cart[0],cart[0]]]) {
    await check("Reject malformed or forged checkout cart "+passed.length,()=>rejected(()=>as(a,()=>submit(randomUUID(),lines)),"22023"));
  }
  await check("Customer identity cannot be injected into delivery data",()=>rejected(()=>as(a,()=>submit(randomUUID(),cart,{...address,customer_id:b})),"22023"));
  await check("Nested delivery JSON rejected",()=>rejected(()=>as(a,()=>submit(randomUUID(),cart,{...address,city:{value:"Tbilisi"}})),"22023"));
  await check("Stock checked at persistence time",()=>rejected(()=>as(a,()=>submit(randomUUID(),[{...cart[0],quantity:11}])),"22023"));
  const key=randomUUID();
  await check("Real order snapshots quantity and trusted price; remains unpaid",async()=>{
    order=(await as(a,()=>submit(key))).rows[0].id;
    const row=(await db.query("select * from orders where id=$1",[order])).rows[0];
    assert.equal(row.customer_id,a); assert.equal(row.payment_status,"pending");assert.equal(row.fulfillment_status,"unfulfilled");assert.equal(row.is_test,false);
    assert.equal(row.subtotal,product.price*3);assert.equal(row.final_total,row.subtotal+row.shipping_total-row.discount_total);assert.equal(row.paid_at,null);
    const item=(await db.query("select * from order_items where order_id=$1",[order])).rows[0];
    assert.equal(item.quantity,3);assert.equal(item.unit_price,product.price);assert.equal(item.line_total,product.price*3);
  });
  await check("Retry returns same order and creates no duplicate",async()=>{
    assert.equal((await as(a,()=>submit(key))).rows[0].id,order);
    assert.equal((await db.query("select count(*)::int n from orders where customer_id=$1",[a])).rows[0].n,1);
  });
  await check("Reused request ID cannot change purchase details",()=>rejected(()=>as(a,()=>submit(key,[{...cart[0],quantity:1}])),"22023"));
  await check("Other customer cannot read order or items",()=>as(b,async()=>{
    assert.equal((await db.query("select id from orders where id=$1",[order])).rows.length,0);
    assert.equal((await db.query("select id from order_items where order_id=$1",[order])).rows.length,0);
  }));
  await check("Private checkout payloads and budgets inaccessible",()=>rejected(()=>as(a,()=>db.query("select * from private.checkout_requests")),"42501"));
  await db.query("insert into promo_codes(code,kind,amount,currency,max_uses,is_active) values ('ONCE','percentage',1000,null,1,true)");
  const promoKey=randomUUID();
  await check("Percentage promo applied once with exact totals",async()=>{
    const id=(await as(a,()=>submit(promoKey,cart,address,"ONCE"))).rows[0].id;
    const row=(await db.query("select * from orders where id=$1",[id])).rows[0];
    assert.equal(row.discount_total,Math.floor(product.price*3*0.1));assert.equal(row.promo_code_snapshot,"ONCE");
    assert.equal((await as(a,()=>submit(promoKey,cart,address,"ONCE"))).rows[0].id,id);
    assert.equal((await db.query("select used_count from promo_codes where code='ONCE'")).rows[0].used_count,1);
  });
  await check("Exhausted promo cannot be reused by another customer",()=>rejected(()=>as(b,()=>submit(randomUUID(),cart,address,"ONCE")),"22023"));
  await check("Failed checkout leaves no idempotency/order record",async()=>{
    const failed=randomUUID();await rejected(()=>as(a,()=>submit(failed,cart,address,"INVALID")),"22023");
    assert.equal((await db.query("select order_id from private.checkout_requests where request_id=$1",[failed])).rows.length,0);
  });
  await check("Customer cannot mark payment or fulfillment",()=>rejected(()=>as(a,()=>db.query("update orders set payment_status='paid' where id=$1",[order])),"42501"));
  await check("Test order disabled by default even for administrator",()=>rejected(()=>as(admin,()=>db.query("select admin_create_test_order($1::jsonb,$2::jsonb)",[JSON.stringify(cart),JSON.stringify(address)])),"42501"));
  await check("Notifications queued transactionally with the real order",async()=>assert.equal((await db.query("select count(*)::int n from notification_outbox where order_id=$1 and event_type='order_received'",[order])).rows[0].n,1));
  for(const statement of ["select notification_prepare($1,'payment_paid')","select notification_record_delivery($1,'email','sent')","select notification_claim($1,'sms')"])
    await check("Customer cannot forge notification event/delivery "+passed.length,()=>rejected(()=>as(a,()=>db.query(statement,[order])),"42501"));
  let notification;
  await check("Backend cannot announce payment for an unpaid order",()=>rejected(()=>as(null,()=>db.query("select notification_prepare($1,'payment_paid')",[order]),"service_role"),"22023"));
  await check("Backend claims each delivery only once",()=>as(null,async()=>{
    notification=(await db.query("select notification_prepare($1,'order_received') n",[order])).rows[0].n.id;
    assert.equal((await db.query("select notification_claim($1,'email') claimed",[notification])).rows[0].claimed,true);
    assert.equal((await db.query("select notification_claim($1,'email') claimed",[notification])).rows[0].claimed,false);
    await db.query("select notification_record_delivery($1,'email','sent')",[notification]);
  },"service_role"));
  await check("Direct checkout has durable per-user limit",async()=>{
    await db.query("insert into private.request_limits(customer_id,scope,window_start,attempts) values($1,'checkout',now(),10) on conflict(customer_id,scope) do update set attempts=10,window_start=now()",[b]);
    await rejected(()=>as(b,()=>submit(randomUUID())),"PT429");
  });
  const line={productId:product.id,variantId:variant.id,quantity:2};
  for(const value of [[{...line,quantity:0}],[{...line,quantity:1.1}],[{...line,price:1}],[{...line,isAdmin:true}],[line,line],{lines:[line]}])
    await check("Strict server cart schema rejects tampering "+passed.length,()=>assert.throws(()=>checkoutLines(value)));
  await check("Valid selected quantity preserved",()=>assert.equal(checkoutLines([line])[0].quantity,2));
  await check("Unexpected object properties rejected",()=>assert.throws(()=>strictObject({name:"A",role:"admin"},["name"])));
  await check("Duplicate form values rejected",()=>{const f=new FormData();f.append("email","a@example.invalid");f.append("email","b@example.invalid");assert.throws(()=>strictForm(f,["email"]));});
  await check("Extra form owner/price fields rejected",()=>{const f=new FormData();f.set("customer_id",b);assert.throws(()=>strictForm(f,["name"]));});
  process.env.SITE_URL="https://store.example.invalid";process.env.NODE_ENV="production";process.env.VERCEL="1";
  await check("Cross-origin, missing and null Origin denied",()=>{
    for(const origin of [undefined,"null","https://evil.invalid","https://store.example.invalid.evil.invalid"]){const h=new Headers({host:"store.example.invalid"});if(origin)h.set("origin",origin);assert.throws(()=>assertSameOrigin(h),e=>e.status===403);}
    assert.doesNotThrow(()=>assertSameOrigin(new Headers({origin:process.env.SITE_URL})));
  });
  const policy=contentSecurityPolicy("fixture-nonce",true);
  await check("Production CSP restricts scripts without eval/inline",()=>{assert.match(policy,/script-src 'self' 'nonce-fixture-nonce' 'strict-dynamic'/);assert.ok(!policy.includes("unsafe-eval"));assert.match(policy,/script-src-attr 'none'/);assert.match(policy,/upgrade-insecure-requests/);});
  delete process.env.UPSTASH_REDIS_REST_URL;delete process.env.UPSTASH_REDIS_REST_TOKEN;delete process.env.RATE_LIMIT_HMAC_KEY;
  await check("Missing production rate backend fails closed",()=>assert.rejects(()=>rateLimit("test","person",2,60),e=>e instanceof RequestError&&e.status===503));
  process.env.UPSTASH_REDIS_REST_URL="https://redis.example.invalid";process.env.UPSTASH_REDIS_REST_TOKEN="fixture";process.env.RATE_LIMIT_HMAC_KEY="security-tests-only-not-a-real-secret";
  let counter=0;
  globalThis.fetch=async(_url,init)=>{const command=JSON.parse(init.body);assert.equal(command[0],"EVAL");assert.ok(!command[3].includes("private@example.invalid"));return Response.json({result:[++counter,60]});};
  await check("Shared atomic rate counter allows budget then rejects",async()=>{await rateLimit("test","private@example.invalid",2,60);await rateLimit("test","private@example.invalid",2,60);await assert.rejects(()=>rateLimit("test","private@example.invalid",2,60),e=>e.status===429);});
  await check("Proxy returns HTTP 429 with Retry-After",async()=>{
    globalThis.fetch=async()=>Response.json({result:[1000,45]});
    const r=await proxy(new NextRequest(process.env.SITE_URL+"/login",{method:"POST",headers:{origin:process.env.SITE_URL,"content-type":"text/plain"},body:"[]"}));
    assert.equal(r.status,429);assert.equal(r.headers.get("retry-after"),"45");
  });
  await check("Extension-like routes cannot bypass CSRF checks",async()=>{const r=await proxy(new NextRequest(process.env.SITE_URL+"/fake.js",{method:"POST",headers:{"content-type":"text/plain"},body:"[]"}));assert.equal(r.status,403);});
  await check("Rate backend outage fails closed",async()=>{globalThis.fetch=async()=>{throw new Error("outage")};await assert.rejects(()=>rateLimit("test","a",2,60),e=>e.status===503);});

  await check("Logout proxy exemption is exact and cannot bypass other actions",async()=>{
    globalThis.fetch=async()=>{throw new Error("Redis unavailable")};
    for(const [path,method,extraHeaders] of [
      ["/login","POST",{}],["/register","POST",{}],["/forgot-password","POST",{}],
      ["/reset-password","POST",{}],["/checkout","POST",{}],["/admin/shipping","POST",{}],
      ["/account","POST",{}],["/auth/logout","POST",{"next-action":"forged-action"}],
      ["/auth/logout","PUT",{}],["/auth/logout/other","POST",{}]
    ]){
      const response=await proxy(new NextRequest(process.env.SITE_URL+path,{method,headers:{origin:process.env.SITE_URL,"content-type":"text/plain",...extraHeaders},body:"[]"}));
      assert.equal(response.status,503,path+" "+method);
    }
  });
  await check("Checkout and admin mutation still fail closed before database work",async()=>{
    globalThis.securityHeaders=new Headers({origin:process.env.SITE_URL,host:"store.example.invalid"});
    let unexpected=0;
    globalThis.fetch=async(input)=>{
      if(!String(input).startsWith("https://redis.example.invalid"))unexpected++;
      throw new Error("private Redis outage detail");
    };
    const {createUnpaidOrder}=await import("../src/app/checkout/unpaid-actions.ts");
    const {saveShippingSettings}=await import("../src/app/admin/shipping/actions.ts");
    const data=new FormData();data.set("shipping_total","0");
    for(const result of [
      await createUnpaidOrder({requestId:randomUUID(),lines:[line],address,promoCode:null}),
      await saveShippingSettings({},data)
    ]){
      assert.equal(result.ok,false);
      assert.equal(result.message,"This service is temporarily unavailable.");
    }
    assert.equal(unexpected,0,"No Supabase calls permitted after limiter failure");
  });

  console.log(passed.length+" security checks passed.");
  await writeFile("qa/security-results.json",JSON.stringify({scope:"Local executable PostgreSQL/PGlite, strict schemas, real proxy and mock Redis transport. Hosted concurrency and provider delivery not exercised.",passed:passed.length,checks:passed},null,2));
} catch(error) { console.error("Security check failed after "+passed.length+" checks:",error.message,error.code??"");process.exitCode=1; }
finally { await db.close();globalThis.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];Object.assign(process.env,original); }
