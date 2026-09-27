// TEST ONLY: local transport fixture. Never used by the application or deployed.
// Auth replies are simulated; SQL executes real RLS in isolated PostgreSQL.
import http from "node:http";
import {createTestDatabase} from "./database-harness.mjs";
const db=await createTestDatabase();
const admin="10000000-0000-4000-8000-000000000003",customer="10000000-0000-4000-8000-000000000001";
await db.query("insert into auth.users(id) values($1),($2)",[admin,customer]);
await db.query("update profiles set role='admin' where id=$1",[admin]);
const jwt=id=>[Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url"),Buffer.from(JSON.stringify({sub:id,role:"authenticated",exp:Math.floor(Date.now()/1000)+3600})).toString("base64url"),"TEST_SIGNATURE"].join(".");
const user=id=>({id,aud:"authenticated",role:"authenticated",email:id===admin?"admin@example.invalid":"customer@example.invalid",email_confirmed_at:new Date().toISOString(),app_metadata:{provider:"email"},user_metadata:{},created_at:new Date().toISOString()});
let queue=Promise.resolve();
const server=http.createServer((req,res)=>{queue=queue.then(async()=>{
let body="";for await(const chunk of req)body+=chunk;
const send=(data,status=200,headers={})=>{res.writeHead(status,{"content-type":"application/json",...headers});res.end(req.method==="HEAD"?"":JSON.stringify(data));};
try{
const url=new URL(req.url,"http://127.0.0.1:54329");
let who=null;try{who=JSON.parse(Buffer.from((req.headers.authorization??"").split(".")[1],"base64url").toString()).sub;}catch{}
if(url.pathname==="/auth/v1/token"){const id=JSON.parse(body).email==="admin@example.invalid"?admin:customer;return send({access_token:jwt(id),refresh_token:"TEST_REFRESH",token_type:"bearer",expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:user(id)});}
if(url.pathname==="/auth/v1/user")return who?send(user(who)):send({message:"No session"},401);
if(url.pathname==="/auth/v1/logout")return send({});
await db.exec("begin");
try{
await db.exec("set local role "+(who?"authenticated":"anon"));await db.query("select set_config('request.jwt.claim.sub',$1,true)",[who??""]);
const table=url.pathname.split("/").pop();
if(url.pathname.includes("/rpc/")){
if(table!=="admin_save_product")throw new Error("Unsupported test RPC");
const p=JSON.parse(body);const row=(await db.query("select admin_save_product($1,$2,$3::jsonb,$4::uuid[]) id",[p.p_id,p.p_expected_updated_at,JSON.stringify(p.p_product),p.p_collection_ids])).rows[0];
await db.exec("commit");return send(row.id);
}
if(!["products","product_variants","product_images","categories","collections","profiles","orders","addresses","product_collections"].includes(table))throw new Error("Unsupported fixture table");
const args=[];const filters=[];
for(const [key,value] of url.searchParams){if(["select","order","limit","offset"].includes(key))continue;if(!/^[a-z_]+$/.test(key))throw new Error("Bad column");
const dot=value.indexOf(".");const op=value.slice(0,dot),val=value.slice(dot+1);
if(op==="in"){const vals=val.replace(/^\(|\)$/g,"").split(",");filters.push("t."+key+" in ("+vals.map(x=>{args.push(x);return "$"+args.length;}).join(",")+")");}
else{const operators={eq:"=",gt:">",lte:"<="};if(!operators[op])throw new Error("Unsupported filter");args.push(val);filters.push("t."+key+operators[op]+"$"+args.length);}
}
const where=filters.length?" where "+filters.join(" and "):"";
let rows;
if(req.method==="PATCH"){
const data=JSON.parse(body);const assignments=Object.entries(data).map(([k,v])=>{if(!/^[a-z_]+$/.test(k))throw new Error("Bad field");args.push(v);return k+"=$"+args.length;});
rows=(await db.query("update "+table+" t set "+assignments.join(",")+where+" returning *",args)).rows;
}else{
let select="t.*";const raw=url.searchParams.get("select")??"";
if(table==="products"&&raw.includes("category:"))select+= ",(select jsonb_build_object('name',c.name,'slug',c.slug) from categories c where c.id=t.category_id) category,coalesce((select jsonb_agg(v.*) from product_variants v where v.product_id=t.id),'[]') variants,coalesce((select jsonb_agg(i.*) from product_images i where i.product_id=t.id),'[]') images";
else if(table==="products"&&raw.includes("product_variants"))select+=",coalesce((select jsonb_agg(v.*) from product_variants v where v.product_id=t.id),'[]') product_variants,coalesce((select jsonb_agg(i.*) from product_images i where i.product_id=t.id),'[]') product_images,coalesce((select jsonb_agg(c.*) from product_collections c where c.product_id=t.id),'[]') product_collections";
const order=(url.searchParams.get("order")??"").split(",").filter(Boolean).map(part=>{const [col,dir]=part.split(".");if(!/^[a-z_]+$/.test(col))throw new Error("Bad sort");return "t."+col+(dir==="desc"?" desc":" asc");});
rows=(await db.query("select "+select+" from "+table+" t"+where+(order.length?" order by "+order.join(","):""),args)).rows;
}
const count=rows.length;const offset=Number(url.searchParams.get("offset")??0),limit=Number(url.searchParams.get("limit")??1000);rows=rows.slice(offset,offset+limit);
await db.exec("commit");
const single=(req.headers.accept??"").includes("vnd.pgrst.object");
send(single?rows[0]??null:rows,200,{"content-range":"0-"+Math.max(0,count-1)+"/"+count});
}catch(e){await db.exec("rollback");send({code:e.code??"TEST",message:e.message},400);}
}catch(e){send({message:e.message},500);}
}).catch(e=>{console.error(e.message);res.end();});});
server.listen(54329,"127.0.0.1",()=>console.log("Test-only Supabase transport listening on 54329"));
