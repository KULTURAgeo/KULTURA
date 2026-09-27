// Reads the environment supplied by the deployment provider.
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
function serviceRoleKeyLooksValid(key){
 if(!key)return false;
 if(key.startsWith("sb_secret_"))return key.length>20&&!/TEST_ONLY|NOT_REAL/.test(key);
 if(!key.startsWith("eyJ"))return false;
 try{return JSON.parse(Buffer.from(key.split(".")[1]??"","base64url").toString()).role==="service_role";}catch{return false;}
}
export function validateProductionEnv(env) {
 const failures=[];
 for(const key of ["SITE_URL","SUPABASE_URL","SUPABASE_PUBLISHABLE_KEY"])if(!env[key])failures.push(key+" is required.");
 for(const key of ["SITE_URL","SUPABASE_URL"]){
  try{const url=new URL(env[key]);if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash||["localhost","127.0.0.1"].includes(url.hostname))throw new Error();}
  catch{failures.push(key+" must be a public HTTPS origin without a path or credentials.");}
 }
 const key=env.SUPABASE_PUBLISHABLE_KEY??"";
 let publicKey=key.startsWith("sb_publishable_")&&key.length>20&&!/TEST_ONLY|NOT_REAL/.test(key);
 if(key.startsWith("eyJ")){try{publicKey=JSON.parse(Buffer.from(key.split(".")[1],"base64url").toString()).role==="anon";}catch{publicKey=false;}}
 if(!publicKey)failures.push("Use a Supabase publishable or legacy anon key; privileged and test keys are forbidden.");
 if(!["true","false",undefined].includes(env.SITE_INDEXABLE))failures.push("SITE_INDEXABLE must be true or false.");
 if(env.STRIPE_SECRET_KEY && (!env.STRIPE_SECRET_KEY.startsWith("sk_test_") || env.STRIPE_SECRET_KEY.length<20))
  failures.push("STRIPE_SECRET_KEY must be a Stripe test-mode secret key (sk_test_...).");
 if(env.STRIPE_WEBHOOK_SECRET && (!env.STRIPE_WEBHOOK_SECRET.startsWith("whsec_") || env.STRIPE_WEBHOOK_SECRET.length<20))
  failures.push("STRIPE_WEBHOOK_SECRET must be a Stripe webhook signing secret (whsec_...).");
 if(env.SUPABASE_SERVICE_ROLE_KEY && !serviceRoleKeyLooksValid(env.SUPABASE_SERVICE_ROLE_KEY))
  failures.push("SUPABASE_SERVICE_ROLE_KEY must be a server-only Supabase service_role/secret key.");
 return failures;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const failures=validateProductionEnv(process.env);
 if(failures.length){console.error("Production configuration invalid:\n"+failures.map(x=>"- "+x).join("\n"));process.exitCode=1;}
 else console.log("Production environment validation passed. No values printed.");
}
