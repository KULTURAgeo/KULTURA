import assert from "node:assert/strict";
import {validateProductionEnv} from "./validate-production-env.mjs";
import {writeFile,readFile} from "node:fs/promises";
import {siteUrl,isIndexable,pageMetadata} from "../src/lib/site.ts";
import {supabaseConfig} from "../src/lib/supabase/config.ts";
import {MAX_UPLOAD_BYTES} from "../src/lib/upload-limits.ts";
const passed=[];const original={...process.env};
const check=(name,fn)=>{fn();passed.push(name);};
try{
 delete process.env.VERCEL;delete process.env.VERCEL_ENV;delete process.env.SITE_URL;
 check("Local metadata origin defaults safely",()=>assert.equal(siteUrl().origin,"http://localhost:3000"));
 process.env.VERCEL="1";
 check("Vercel requires explicit origin",()=>assert.throws(()=>siteUrl()));
 for(const value of ["http://localhost:3000","https://user:pass@store.example","https://store.example/path","https://store.example?token=x"]){process.env.SITE_URL=value;check("Reject malformed/development origin "+value.replace("user:pass@",""),()=>assert.throws(()=>siteUrl()));}
 process.env.SITE_URL="https://store.example";process.env.SITE_INDEXABLE="true";process.env.VERCEL_ENV="preview";
 check("Preview indexing always disabled",()=>assert.equal(isIndexable(),false));
 process.env.VERCEL_ENV="production";check("Production indexing explicitly enabled",()=>assert.equal(isIndexable(),true));
 process.env.SITE_INDEXABLE="false";check("Production prelaunch noindex",()=>assert.equal(isIndexable(),false));
 check("Canonical and social metadata use page path",()=>assert.equal(pageMetadata("Shop","/shop").alternates.canonical,"/shop"));
 process.env.SUPABASE_URL="https://user:password@example.supabase.co";process.env.SUPABASE_PUBLISHABLE_KEY="sb_publishable_TEST_ONLY";
 check("Supabase credential-bearing URLs rejected",()=>assert.throws(()=>supabaseConfig()));
 check("Upload leaves room beneath Vercel payload limit",()=>assert.equal(MAX_UPLOAD_BYTES,3145728));
 const env={...original,SITE_URL:"http://localhost:3000",SUPABASE_URL:"https://example.supabase.co",SUPABASE_PUBLISHABLE_KEY:"sb_secret_TEST_ONLY_NOT_REAL"};
 check("Production build rejects insecure/test configuration without printing values",()=>{const failures=validateProductionEnv(env);assert.ok(failures.length>0);assert.ok(!failures.join(" ").includes(env.SUPABASE_PUBLISHABLE_KEY));});
 const config=JSON.parse(await readFile("vercel.json","utf8"));
 check("Vercel invokes deployment environment validation",()=>assert.equal(config.buildCommand,"pnpm run build:vercel"));
 await writeFile("qa/production-unit-results.json",JSON.stringify({passed:passed.length,checks:passed},null,2));console.log(passed.length+" production configuration checks passed.");
}finally{for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];Object.assign(process.env,original);}
