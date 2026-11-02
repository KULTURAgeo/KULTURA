import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";
const base=process.env.QA_BASE_URL || "http://localhost:3000";
const checks=[];
async function check(name,fn){await fn();checks.push(name);}
for(const route of ["/","/shop","/drops","/about","/contact","/shipping","/returns","/privacy","/terms","/size-guide","/login","/register","/forgot-password","/cart"]){
 await check("Public route and security headers "+route,async()=>{const r=await fetch(base+route);assert.equal(r.status,200);assert.equal(r.headers.get("x-content-type-options"),"nosniff");assert.equal(r.headers.get("x-frame-options"),"DENY");assert.equal(r.headers.get("x-permitted-cross-domain-policies"),"none");assert.match(r.headers.get("content-security-policy")??"",/frame-ancestors 'none'/);assert.match(r.headers.get("content-security-policy")??"",/object-src 'none'/);assert.match(r.headers.get("x-robots-tag"),/noindex/);assert.ok((await r.text()).includes("<h1"));});
}
for(const route of ["/constructor","/toString","/this-page-does-not-exist"]){
 await check("Unknown information page is 404 "+route,async()=>assert.equal((await fetch(base+route)).status,404));
}
await check("Reject XML request bodies",async()=>{const r=await fetch(base+"/",{method:"POST",headers:{"content-type":"application/xml"},body:"<?xml version=\"1.0\"?><root/>"});assert.equal(r.status,415);assert.equal(r.headers.get("x-content-type-options"),"nosniff");assert.match(r.headers.get("cache-control")??"",/no-store/);});
await check("Reject +xml request bodies",async()=>{const r=await fetch(base+"/",{method:"POST",headers:{"content-type":"application/soap+xml; charset=utf-8"},body:"<Envelope/>"});assert.equal(r.status,415);});
await check("CSP uses a fresh nonce matching inline framework scripts",async()=>{
 const response=await fetch(base+"/");const policy=response.headers.get("content-security-policy");
 const nonce=policy.match(/'nonce-([^']+)'/)[1];const html=await response.text();
 assert.ok(!policy.includes("unsafe-eval"));assert.match(policy,/script-src-attr 'none'/);
 for(const script of html.matchAll(/<script\b([^>]*)>/g))assert.ok(script[1].includes('nonce="'+nonce+'"'),"Script missing request nonce");
 const second=await fetch(base+"/");assert.notEqual(second.headers.get("content-security-policy"),policy);
 assert.match(response.headers.get("cache-control"),/no-store/);
});
await check("Missing and cross-site Origin cannot invoke actions",async()=>{
 for(const origin of [undefined,"https://evil.invalid"]){const headers={"content-type":"text/plain"};if(origin)headers.origin=origin;const r=await fetch(base+"/login",{method:"POST",headers,body:"[]"});assert.equal(r.status,403);}
});
await check("Extension-like action target cannot bypass CSRF",async()=>{const r=await fetch(base+"/fake.js",{method:"POST",headers:{"content-type":"text/plain"},body:"[]"});assert.equal(r.status,403);});
await check("Prelaunch robots blocks indexing",async()=>assert.match(await(await fetch(base+"/robots.txt")).text(),/Disallow: \//));
await check("Prelaunch sitemap excludes URLs",async()=>assert.ok(!(await(await fetch(base+"/sitemap.xml")).text()).includes("<loc>")));
for(const path of ["/social-card.png","/apple-touch-icon.png","/icon.svg"]){
 await check("Metadata asset "+path,async()=>{const r=await fetch(base+path);assert.equal(r.status,200);assert.match(r.headers.get("content-type"),/image\//);});
}
await check("Canonical and Open Graph metadata",async()=>{const html=await(await fetch(base+"/shop")).text();assert.match(html,/rel="canonical" href="http:\/\/localhost:3000\/shop"/);assert.match(html,/social-card.png/);});
await check("Invalid callback never follows external next URL",async()=>{const r=await fetch(base+"/auth/callback?code=invalid&next=https://example.invalid",{redirect:"manual"});assert.ok([303,307].includes(r.status));assert.ok(new URL(r.headers.get("location")).pathname==="/login");assert.match(r.headers.get("cache-control"),/no-store/);});
await writeFile("qa/production-http-results.json",JSON.stringify({scope:"Latest production build; Supabase unconfigured; prelaunch indexing disabled",passed:checks.length,checks},null,2));
console.log(checks.length+" production HTTP checks passed");
