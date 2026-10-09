// Integration regressions using the real Supabase SSR SDK and in-memory HTTP/cookie adapters.
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";

const cookieValues = new Map(), cookieWrites = [];
globalThis.__authJar = {
 getAll: () => [...cookieValues].map(([name,value]) => ({name,value})),
 set(name,value,options) { cookieWrites.push({name,value,options}); if(options.maxAge===0)cookieValues.delete(name);else cookieValues.set(name,value); }
};
registerHooks({resolve(specifier,context,next){
 if(specifier==="next/headers")return {shortCircuit:true,url:"data:text/javascript,export async function cookies(){return globalThis.__authJar}"};
 if(specifier==="next/cache")return {shortCircuit:true,url:"data:text/javascript,export function revalidatePath(){}"};
 if(specifier==="next/navigation")return {shortCircuit:true,url:"data:text/javascript,export function redirect(url){throw Object.assign(new Error('redirect'),{redirectTo:url})}"};
 if(specifier==="next/server")return next("next/server.js",context);
 if(specifier.startsWith("@/"))return next(pathToFileURL(resolve("src",specifier.slice(2)+".ts")).href,context);
 return next(specifier,context);
}});
process.env.SUPABASE_URL="https://auth-fixture.supabase.co";
process.env.SUPABASE_PUBLISHABLE_KEY=["sb","publishable","AUTH_SESSION_FIXTURE"].join("_");
process.env.SITE_URL="https://store.example.invalid";
process.env.VERCEL="1";
const user={id:"10000000-0000-4000-8000-000000000001",aud:"authenticated",role:"authenticated",email:"session@example.invalid",app_metadata:{provider:"email"},user_metadata:{},created_at:new Date().toISOString()};
const token=(expires=3600)=>[Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url"),Buffer.from(JSON.stringify({sub:user.id,aud:"authenticated",role:"authenticated",exp:Math.floor(Date.now()/1000)+expires})).toString("base64url"),"FIXTURE_SIGNATURE"].join(".");
const session=(expires=3600)=>({access_token:token(expires),refresh_token:"FIXTURE_REFRESH",token_type:"bearer",expires_in:expires,expires_at:Math.floor(Date.now()/1000)+expires,user});
let profileFailure=false, authFailure=false, refreshCount=0;
const requests=[];
globalThis.fetch=async(input,init={})=>{
 const url=new URL(typeof input==="string"?input:input.url??input);
 requests.push({path:url.pathname,search:url.search,body:init.body});
 const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json"}});
 if(url.pathname==="/auth/v1/token"){if(url.searchParams.get("grant_type")==="refresh_token")refreshCount++;return json(session());}
 if(url.pathname==="/auth/v1/user")return authFailure?json({message:"Unavailable"},503):json(user);
 if(url.pathname==="/auth/v1/signup")return json({user,session:null});
 if(url.pathname==="/auth/v1/recover")return json({});
 if(url.pathname==="/auth/v1/verify")return json(session());
 if(url.pathname==="/auth/v1/logout")return json({});
 if(url.pathname==="/rest/v1/profiles")return profileFailure?json({code:"PGRST116",message:"Profile missing"},406):json({id:user.id,role:"customer",full_name:null,phone:null});
 throw new Error("Unexpected fixture request: "+url.pathname);
};
const {authenticate,logout}=await import("../src/app/auth/actions.ts");
const {requirePage}=await import("../src/lib/auth/guards.ts");
const {proxy}=await import("../src/proxy.ts");
const {NextRequest}=await import("next/server");
const {createBrowserSessionClient}=await import("../src/lib/supabase/client.ts");
const {GET:callback}=await import("../src/app/auth/callback/route.ts");
const {GET:confirm}=await import("../src/app/auth/confirm/route.ts");
const passed=[];
async function check(name,fn){await fn();passed.push(name);}
const form=(mode,extra={})=>{const data=new FormData();for(const [key,value]of Object.entries({mode,email:user.email,password:"fixture-password-123",confirm_password:"fixture-password-123",...extra}))data.set(key,value);return data;};
await check("Unauthenticated account redirects to login",async()=>{await assert.rejects(()=>requirePage(),e=>e.redirectTo==="/login?next=/account");});
await check("Password login persists production cookies and safe next destination",async()=>{
 const result=await authenticate({},form("login",{next:"/account/orders"}));
 assert.equal(result.redirectTo,"/account/orders");assert.equal(result.reload,true);
 assert.ok(cookieWrites.some(c=>c.name.includes("auth-token")));
 for(const c of cookieWrites){assert.equal(c.options.httpOnly,false);assert.equal(c.options.secure,true);assert.equal(c.options.path,"/");assert.equal(c.options.sameSite,"lax");assert.equal(c.options.domain,undefined);}
});
await check("New server request reads login cookies and grants account access",async()=>{assert.equal((await requirePage()).user.id,user.id);});
await check("Authenticated customer still cannot access admin",async()=>{await assert.rejects(()=>requirePage(true),e=>e.redirectTo==="/account?restricted=1");});
await check("Profile failure is not disguised as a logged-out session",async()=>{profileFailure=true;try{await assert.rejects(()=>requirePage(),e=>e.code==="unavailable"&&!e.redirectTo);}finally{profileFailure=false;}});
await check("Auth service outage does not become a login redirect",async()=>{authFailure=true;try{await assert.rejects(()=>requirePage(),e=>e.code==="unavailable"&&!e.redirectTo);}finally{authFailure=false;}});
await check("External next destination is rejected",async()=>{assert.equal((await authenticate({},form("login",{next:"https://evil.invalid"}))).redirectTo,"/account");});

globalThis.window={location:{protocol:"https:",href:"https://store.example.invalid/login"},addEventListener(){},removeEventListener(){}};
globalThis.document={visibilityState:"hidden",addEventListener(){},removeEventListener(){}};
Object.defineProperty(document,"cookie",{get:()=>[...cookieValues].map(([k,v])=>k+"="+encodeURIComponent(v)).join("; "),set:line=>{const [pair,...options]=line.split(";");const at=pair.indexOf("=");const name=pair.slice(0,at),value=decodeURIComponent(pair.slice(at+1));if(options.some(o=>/max-age=0/i.test(o)))cookieValues.delete(name);else cookieValues.set(name,value);}});
window.document=document;
globalThis.BroadcastChannel=undefined;
// SDK browser/server runtimes intentionally share one process in this test.
const originalWarn=console.warn;
console.warn=(...args)=>{if(!String(args[0]).includes("Multiple GoTrueClient instances"))originalWarn(...args);};
const browser=createBrowserSessionClient({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_PUBLISHABLE_KEY});
await check("Browser SSR client sees the server-issued session",async()=>{assert.equal((await browser.auth.getSession()).data.session.user.id,user.id);});
await check("Browser password sign-in is persisted for a new server request",async()=>{
 assert.equal((await browser.auth.signInWithPassword({email:user.email,password:"fixture-password-123"})).error,null);
 assert.equal((await requirePage()).user.id,user.id);
});
await browser.auth.stopAutoRefresh();
await check("Proxy avoids a second Auth user lookup with fresh cookies",async()=>{
 cookieValues.clear();
 const fresh=session();
 cookieValues.set("sb-auth-fixture-auth-token","base64-"+Buffer.from(JSON.stringify(fresh)).toString("base64url"));
 const request=new NextRequest("https://store.example.invalid/admin",{headers:{cookie:[...cookieValues].map(([k,v])=>k+"="+v).join("; ")}});
 const callsBefore=requests.filter(r=>r.path==="/auth/v1/user").length;
 const response=await proxy(request);
 const callsAfter=requests.filter(r=>r.path==="/auth/v1/user").length;
 assert.equal(callsAfter,callsBefore);
 assert.match(response.headers.get("cache-control"),/no-store/);
 assert.equal((await requirePage()).user.id,user.id);
 await assert.rejects(()=>requirePage(true),e=>e.redirectTo==="/account?restricted=1");
});
await check("Proxy refresh forwards rotated cookies to browser and downstream server",async()=>{
 cookieValues.clear();
 const expired=session(-60);
 cookieValues.set("sb-auth-fixture-auth-token","base64-"+Buffer.from(JSON.stringify(expired)).toString("base64url"));
 const request=new NextRequest("https://store.example.invalid/account",{headers:{cookie:[...cookieValues].map(([k,v])=>k+"="+v).join("; ")}});
 const before=refreshCount;
 const response=await proxy(request);
 assert.ok(refreshCount>before);
 const updated=response.cookies.getAll().filter(c=>c.name.includes("auth-token"));
 assert.ok(updated.length>0);
 assert.match(response.headers.get("cache-control"),/no-store/);
 assert.equal(response.headers.get("pragma"),"no-cache");
 assert.equal(response.headers.get("expires"),"0");
 assert.ok(response.headers.get("x-middleware-request-cookie")?.includes("sb-auth-fixture-auth-token"));
 for(const c of updated)globalThis.__authJar.set(c.name,c.value,c);
 assert.equal((await requirePage()).user.id,user.id);
});
await check("Registration uses configured production callback and stores PKCE verifier",async()=>{
 const result=await authenticate({},form("register"));assert.equal(result.ok,true);
 const request=requests.findLast(r=>r.path==="/auth/v1/signup");assert.match(request.search,/store.example.invalid/);
 assert.ok([...cookieValues.keys()].some(k=>k.includes("code-verifier")));
});
await check("Email PKCE exchange writes session before account redirect",async()=>{
 const response=await callback(new NextRequest("https://store.example.invalid/auth/callback?code=fixture-code"));
 assert.equal(response.headers.get("location"),"https://store.example.invalid/account");
 assert.equal((await requirePage()).user.id,user.id);
});
await check("Email token-hash confirmation persists session",async()=>{
 const response=await confirm(new NextRequest("https://store.example.invalid/auth/confirm?token_hash=fixture&type=email"));
 assert.equal(response.headers.get("location"),"https://store.example.invalid/account");
 assert.equal((await requirePage()).user.id,user.id);
});
await check("Password recovery uses production URL",async()=>{
 assert.equal((await authenticate({},form("forgot"))).ok,true);
 assert.match(requests.findLast(r=>r.path==="/auth/v1/recover").search,/store.example.invalid/);
});
await check("Recovery confirmation redirects to password reset",async()=>{
 const response=await confirm(new NextRequest("https://store.example.invalid/auth/confirm?token_hash=fixture&type=recovery"));
 assert.equal(response.headers.get("location"),"https://store.example.invalid/reset-password");
});
await check("Password update clears cookies and reloads login",async()=>{
 const result=await authenticate({},form("reset"));
 assert.equal(result.redirectTo,"/login?reset=1");assert.equal(result.reload,true);
 await assert.rejects(()=>requirePage(),e=>e.redirectTo==="/login?next=/account");
});
await check("Logout clears persisted session after a new login",async()=>{
 await authenticate({},form("login"));
 assert.equal((await logout()).redirectTo,"/login");
 await assert.rejects(()=>requirePage(),e=>e.redirectTo==="/login?next=/account");
});
await check("Invalid confirmation link cannot create session",async()=>{
 const response=await confirm(new NextRequest("https://store.example.invalid/auth/confirm?type=admin"));
 assert.equal(response.headers.get("location"),"https://store.example.invalid/login?auth_error=1");
});
await browser.auth.stopAutoRefresh();
await writeFile("qa/auth-session-results.json",JSON.stringify({scope:"Real SSR SDK, auth actions, guards, proxy and callback routes with simulated Supabase HTTP and cookies; not hosted Supabase.",passed:passed.length,checks:passed},null,2));
console.warn=originalWarn;
console.log(passed.length+" authentication/session integration checks passed");
