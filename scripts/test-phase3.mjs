import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";
import sharp from "sharp";
import {createTestDatabase} from "./database-harness.mjs";
import {addLine,removeLine,changeQuantity,normalizeLines,readStoredCart,quoteLines} from "../src/lib/cart/model.ts";
import {verifyActor} from "../src/lib/auth/access.ts";
import {price,safeNext,variantInput,productInput,promoInput} from "../src/lib/validation.ts";
import {processProductImage} from "../src/lib/admin/image.ts";
const passed=[];const check=async(name,fn)=>{await fn();passed.push(name);};
const a="10000000-0000-4000-8000-000000000001",b="10000000-0000-4000-8000-000000000002",admin="10000000-0000-4000-8000-000000000003";
const db=await createTestDatabase();
async function as(who,fn,role="authenticated"){await db.exec("begin");try{await db.exec("set local role "+role);await db.query("select set_config('request.jwt.claim.sub',$1,true)",[who??""]);return await fn();}finally{await db.exec("rollback");}}
async function denied(who,sql,args=[],code="42501"){await as(who,()=>assert.rejects(()=>db.query(sql,args),e=>e.code===code));}
const form=obj=>{const f=new FormData();for(const [k,v]of Object.entries(obj))f.set(k,String(v));return f;};
try{
await db.exec("update private.checkout_settings set test_checkout_enabled=true");
await db.query("insert into auth.users(id,email,raw_user_meta_data) values ($1,'a@example.invalid','{\"role\":\"admin\"}'),($2,'b@example.invalid','{}'),($3,'admin@example.invalid','{}')",[a,b,admin]);
await db.query("update profiles set role='admin' where id=$1",[admin]);
const p=(await db.query("select * from products order by slug limit 1")).rows[0];
const v=(await db.query("select * from product_variants where product_id=$1 limit 1",[p.id])).rows[0];
const product={name:"Test product",slug:"test-product",description:"Test",price:12000,compare_at_price:null,status:"draft",featured:false,is_drop:false,category_id:p.category_id,seo_title:null,seo_description:null};
const save="select admin_save_product($1,$2,$3::jsonb,$4::uuid[]) id";
await check("Metadata cannot promote customer",async()=>assert.equal((await db.query("select role from profiles where id=$1",[a])).rows[0].role,"customer"));
for(const who of [a,admin])await check("Protected role update denied: "+who,()=>denied(who,"update profiles set role='admin' where id=$1",[who]));
await check("Anonymous product RPC denied",()=>as(null,()=>assert.rejects(()=>db.query(save,[null,null,JSON.stringify(product),[]]),e=>e.code==="42501"),"anon"));
await check("Customer product RPC denied",()=>denied(a,save,[null,null,JSON.stringify(product),[]]));
await check("Customer direct price/inventory updates affect no rows",()=>as(a,async()=>{
assert.equal((await db.query("update products set price=1 where id=$1 returning id",[p.id])).rows.length,0);
assert.equal((await db.query("update product_variants set stock_quantity=999 where id=$1 returning id",[v.id])).rows.length,0);
}));
await check("Admin creates and edits product transactionally",()=>as(admin,async()=>{
const id=(await db.query(save,[null,null,JSON.stringify(product),[]])).rows[0].id;
const row=(await db.query("select updated_at::text version from products where id=$1",[id])).rows[0];
await db.query(save,[id,row.version,JSON.stringify({...product,price:15000}),[]]);
assert.equal((await db.query("select price from products where id=$1",[id])).rows[0].price,15000);
}));
await check("Stale product edit rejected",()=>denied(admin,save,[p.id,"2000-01-01",JSON.stringify(product),[]],"40001"));
await check("Invalid product price rejected by database",()=>denied(admin,save,[null,null,JSON.stringify({...product,price:-1}),[]],"23514"));
await check("Invalid collection relationship rejects whole save",async()=>{
await denied(admin,save,[null,null,JSON.stringify(product),[b]],"23503");
assert.equal((await db.query("select id from products where slug='test-product'")).rows.length,0);
});
await check("Negative inventory rejected",()=>denied(admin,"update product_variants set stock_quantity=-1 where id=$1",[v.id],"23514"));
await check("Invalid SKU rejected",()=>denied(admin,"update product_variants set sku='bad sku' where id=$1",[v.id],"23514"));
await check("Valid admin inventory update succeeds",()=>as(admin,async()=>assert.equal((await db.query("update product_variants set stock_quantity=7 where id=$1 returning stock_quantity",[v.id])).rows[0].stock_quantity,7)));
await check("Customer profile isolation",()=>as(a,async()=>assert.deepEqual((await db.query("select id from profiles")).rows.map(r=>r.id),[a])));
const address={recipient_name:"Test",phone:"123456",country_code:"GE",city:"Tbilisi",address_line_1:"Test 1",address_line_2:null,postal_code:null,is_default:true};
await check("Address owner comes from authenticated identity and default switches atomically",()=>as(a,async()=>{
await db.query("select customer_save_address(null,$1::jsonb)",[JSON.stringify(address)]);
await db.query("select customer_save_address(null,$1::jsonb)",[JSON.stringify(address)]);
const rows=(await db.query("select profile_id,is_default from addresses")).rows;
assert.equal(rows.length,2);assert.ok(rows.every(r=>r.profile_id===a));assert.equal(rows.filter(r=>r.is_default).length,1);
}));
const other=(await db.query("insert into addresses(profile_id,recipient_name,phone,city,address_line_1) values($1,'Test','123','Tbilisi','Test') returning id",[b])).rows[0].id;
await check("Address IDOR denied",()=>denied(a,"select customer_save_address($1,$2::jsonb)",[other,JSON.stringify(address)]));
await db.query("insert into orders(customer_id,subtotal,final_total,customer_email,delivery_name,delivery_phone,delivery_country_code,delivery_city,delivery_address_line_1) values($1,100,100,'test@example.invalid','Test','123','GE','Tbilisi','Test')",[b]);
await check("Other customer orders hidden",()=>as(a,async()=>assert.equal((await db.query("select * from orders")).rows.length,0)));
await check("Admin can read real orders",()=>as(admin,async()=>assert.equal((await db.query("select * from orders")).rows.length,1)));
for(const who of [a,admin])await check("Order total/payment writes denied: "+who,()=>denied(who,"update orders set payment_status='paid',final_total=0"));
const testCart=JSON.stringify([{product_id:p.id,variant_id:v.id,quantity:1}]);
const testAddress=JSON.stringify({recipient_name:"KULTURA TEST",phone:"555000000",city:"Tbilisi",address_line_1:"Test 1",address_line_2:null,postal_code:"0170"});
await check("Customer cannot create paid test checkout",()=>denied(a,"select admin_create_test_order($1::jsonb,$2::jsonb)",[testCart,testAddress]));
await check("Admin test checkout reprices server-side and does not decrement stock",()=>as(admin,async()=>{
const before=(await db.query("select stock_quantity from product_variants where id=$1",[v.id])).rows[0].stock_quantity;
const orderId=(await db.query("select admin_create_test_order($1::jsonb,$2::jsonb) id",[testCart,testAddress])).rows[0].id;
const order=(await db.query("select * from orders where id=$1",[orderId])).rows[0];
assert.equal(order.is_test,true);
assert.equal(order.customer_id,admin);
assert.equal(order.customer_email,"admin@example.invalid");
assert.equal(order.payment_status,"paid");
assert.equal(order.fulfillment_status,"unfulfilled");
assert.equal(order.subtotal,p.price);
assert.equal(order.shipping_total,p.price>=19900?0:1000);
assert.equal(order.final_total,p.price+(p.price>=19900?0:1000));
const item=(await db.query("select * from order_items where order_id=$1",[orderId])).rows[0];
assert.equal(item.unit_price,p.price);
assert.equal(item.quantity,1);
assert.equal(item.line_total,p.price);
assert.equal((await db.query("select stock_quantity from product_variants where id=$1",[v.id])).rows[0].stock_quantity,before);
}));
const promoPayload=JSON.stringify({code:"SAVE10",kind:"percentage",amount:1000,currency:null,minimum_subtotal:0,maximum_discount:null,starts_at:null,expires_at:null,max_uses:3,is_active:true});
await check("Customer cannot create promo codes",()=>denied(a,"select admin_save_promo(null,null,$1::jsonb)",[promoPayload]));
await check("Admin can create and read promo codes",()=>as(admin,async()=>{
const id=(await db.query("select admin_save_promo(null,null,$1::jsonb) id",[promoPayload])).rows[0].id;
assert.equal((await db.query("select id from promo_codes where id=$1",[id])).rows.length,1);
}));
const promoId=(await db.query("insert into promo_codes(code,kind,amount,currency,minimum_subtotal,maximum_discount,starts_at,expires_at,max_uses,is_active) values('SAVE10','percentage',1000,null,0,null,null,null,3,true) returning id")).rows[0].id;
await check("Promo codes cannot be enumerated by customers",()=>as(a,async()=>assert.equal((await db.query("select * from promo_codes")).rows.length,0)));
await check("Customer can validate an exact promo without enumerating codes",()=>as(a,async()=>{
const row=(await db.query("select (checkout_quote_promo('SAVE10',$1)->>'valid')::boolean valid,(checkout_quote_promo('SAVE10',$1)->>'discount')::int discount",[p.price])).rows[0];
assert.equal(row.valid,true);
assert.equal(row.discount,Math.floor(p.price*.10));
}));
await check("Test checkout applies promo server-side without consuming usage",()=>as(admin,async()=>{
const beforeUses=(await db.query("select used_count from promo_codes where id=$1",[promoId])).rows[0].used_count;
const orderId=(await db.query("select admin_create_test_order_v2($1::jsonb,$2::jsonb,$3) id",[testCart,testAddress,"SAVE10"])).rows[0].id;
const order=(await db.query("select * from orders where id=$1",[orderId])).rows[0];
const discount=Math.floor(p.price*.10);
const shipping=p.price>=19900?0:1000;
assert.equal(order.promo_code_snapshot,"SAVE10");
assert.equal(order.discount_total,discount);
assert.equal(order.final_total,p.price+shipping-discount);
assert.equal((await db.query("select used_count from promo_codes where id=$1",[promoId])).rows[0].used_count,beforeUses);
}));
const path=p.id+"/"+a+".webp";
await check("Customer Storage upload denied",()=>denied(a,"insert into storage.objects(bucket_id,name) values('product-images',$1)",[path]));
await check("Admin Storage upload/delete allowed",()=>as(admin,async()=>{await db.query("insert into storage.objects(bucket_id,name) values('product-images',$1)",[path]);assert.equal((await db.query("delete from storage.objects where name=$1 returning name",[path])).rows.length,1);}));
await check("Admin unsafe Storage path rejected",()=>denied(admin,"insert into storage.objects(bucket_id,name) values('product-images','../bad.svg')"));
await check("Image attachment and reorder are consistent",()=>as(admin,async()=>{
await db.query("select admin_attach_image($1,$2,'Test alt')",[p.id,path]);
const ids=(await db.query("select id from product_images where product_id=$1 order by sort_position",[p.id])).rows.map(r=>r.id);
const reversed=[...ids].reverse();
await db.query("select admin_reorder_images($1,$2::uuid[],$3::uuid[])",[p.id,reversed,ids]);
assert.deepEqual((await db.query("select id from product_images where product_id=$1 order by sort_position",[p.id])).rows.map(r=>r.id),reversed);
}));
await check("Seed remains repeatable under new image constraint",async()=>{const {readFile}=await import("node:fs/promises");await db.exec(await readFile("supabase/seed.sql","utf8"));assert.equal((await db.query("select count(*)::int n from products")).rows[0].n,4);});
const line={productId:a,variantId:b,size:"S",color:"Black",quantity:1};
const catalog=[{id:a,name:"Test",slug:"test",price:12000,image:"/test.webp",variants:[{id:b,size:"M",color:"Silver",stock:3}]}];
await check("Cart add, duplicate merge, remove and quantity",()=>{let l=addLine([],line);l=addLine(l,line);assert.equal(l[0].quantity,2);assert.equal(changeQuantity(l,b,3)[0].quantity,3);assert.deepEqual(removeLine(l,b),[]);});
await check("Invalid quantities and corrupt storage are safe",()=>{for(const n of [-1,0,1.5,100,NaN]){assert.deepEqual(normalizeLines([{...line,quantity:n}]),[]);assert.equal(changeQuantity([line],b,n)[0].quantity,1);}for(const raw of ["{","null",'{"version":9,"items":[]}',"x".repeat(30001)])assert.deepEqual(readStoredCart(raw),[]);});
await check("Cart ignores submitted prices and stock; derives variant labels",()=>{const normalized=normalizeLines([{...line,price:1,total:1,stock:999}]);const q=quoteLines(normalized,catalog);assert.equal(q.subtotal,12000);assert.equal(q.lines[0].size,"M");assert.equal(q.lines[0].color,"Silver");assert.equal("price" in normalized[0],false);});
await check("Cart clamps quantity to stock and flags price changes",()=>{const q=quoteLines([{...line,quantity:9,observedPrice:1}],catalog);assert.equal(q.subtotal,36000);assert.equal(q.lines[0].quantity,3);assert.match(q.lines[0].notice,/price has changed/);});
await check("Missing/inactive products and removed variants are unavailable",()=>{assert.equal(quoteLines([line],[]).subtotal,0);assert.equal(quoteLines([line],[{...catalog[0],variants:[]}]).lines[0].available,false);});
await check("Sold-out stock excludes line from subtotal",()=>assert.equal(quoteLines([line],[{...catalog[0],variants:[{...catalog[0].variants[0],stock:0}]}]).subtotal,0));
await check("Validation rejects invalid price, slug, SKU and stock",()=>{assert.equal(price("12.34"),1234);for(const val of ["-1","1e4","1.234","NaN"])assert.throws(()=>price(val));assert.throws(()=>variantInput(form({sku:"bad sku",size:"M",color:"Black",stock_quantity:1})));assert.throws(()=>variantInput(form({sku:"TEST",size:"M",color:"Black",stock_quantity:-1})));assert.throws(()=>productInput(form({...product,price:"12",slug:"../bad"})));assert.equal(safeNext("//evil.test"),"/account");assert.equal(safeNext("/checkout"),"/checkout");});
await check("Promo validation normalizes codes and percentage basis points",()=>{const promo=promoInput(form({code:"save10",kind:"percentage",amount:"10",minimum_subtotal:"0",maximum_discount:"",max_uses:"5",starts_at:"",expires_at:"",is_active:"on"}));assert.equal(promo.code,"SAVE10");assert.equal(promo.amount,1000);assert.equal(promo.max_uses,5);assert.equal(promo.is_active,true);assert.throws(()=>promoInput(form({code:"bad code",kind:"percentage",amount:"10",minimum_subtotal:"0",maximum_discount:"",max_uses:"",starts_at:"",expires_at:""})));assert.throws(()=>promoInput(form({code:"TOO",kind:"percentage",amount:"101",minimum_subtotal:"0",maximum_discount:"",max_uses:"",starts_at:"",expires_at:""})));});
function client(user,role){return {auth:{getUser:async()=>({data:{user},error:null})},from:()=>({select:()=>({eq:(_key,id)=>({single:async()=>({data:{id,role},error:null})})})})};}
await check("Server auth rejects missing/expired identity",()=>assert.rejects(()=>verifyActor(client(null,"admin")),e=>e.code==="unauthenticated"));
await check("Customer cannot bypass admin server guard",()=>assert.rejects(()=>verifyActor(client({id:a,user_metadata:{role:"admin"}},"customer"),true),e=>e.code==="forbidden"));
await check("Server-verified protected profile permits admin",async()=>assert.equal((await verifyActor(client({id:admin},"admin"),true)).profile.role,"admin"));
await check("Admin role revocation takes effect on subsequent verification",()=>assert.rejects(()=>verifyActor(client({id:admin},"customer"),true),e=>e.code==="forbidden"));
await check("Upload decodes and re-encodes safe WebP",async()=>{const bytes=await sharp({create:{width:10,height:10,channels:3,background:"#000"}}).png().toBuffer();const result=await processProductImage(new File([bytes],"../../evil.png",{type:"image/png"}));assert.equal((await sharp(result).metadata()).format,"webp");});
await check("Upload rejects SVG, fake MIME and oversized files",async()=>{await assert.rejects(()=>processProductImage(new File(["<svg/>"],"a.svg",{type:"image/svg+xml"})));await assert.rejects(()=>processProductImage(new File(["not an image"],"a.png",{type:"image/png"})));await assert.rejects(()=>processProductImage(new File([new Uint8Array(3*1024*1024+1)],"a.png",{type:"image/png"})));});
await writeFile("qa/phase3-results.json",JSON.stringify({scope:"Local PostgreSQL RLS, pure cart/validation, server authorization contract, image decoding. Hosted Auth and Storage not exercised.",passed:passed.length,checks:passed},null,2));
console.log(passed.length+" Phase 3 checks passed");
}finally{await db.close();}
