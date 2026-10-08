// Reads the environment supplied by the deployment provider.
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
export function validateProductionEnv(env) {
 const failures=[];
 for(const key of ["SITE_URL","SUPABASE_URL","SUPABASE_PUBLISHABLE_KEY"])if(!env[key])failures.push(key+" is required.");
 for(const key of ["SITE_URL","SUPABASE_URL"]){
  try{const url=new URL(env[key]);if(url.protocol!=="https:"||url.username||url.password||url.pathname!=="/"||url.search||url.hash||["localhost","127.0.0.1"].includes(url.hostname))throw new Error();}
  catch{failures.push(key+" must be a public HTTPS origin without a path or credentials.");}
 }
 for(const key of ["UPSTASH_REDIS_REST_URL","UPSTASH_REDIS_REST_TOKEN","RATE_LIMIT_HMAC_KEY"])if(!env[key])failures.push(key+" is required for persistent rate limiting.");
 try{const url=new URL(env.UPSTASH_REDIS_REST_URL);if(url.protocol!=="https:"||url.username||url.password)throw new Error();}catch{failures.push("UPSTASH_REDIS_REST_URL must use HTTPS.");}
 if((env.RATE_LIMIT_HMAC_KEY??"").length<32)failures.push("RATE_LIMIT_HMAC_KEY must contain at least 32 random characters.");
 if((env.RESEND_API_KEY||env.TWILIO_AUTH_TOKEN)&&!env.SUPABASE_SECRET_KEY)failures.push("SUPABASE_SECRET_KEY is required for backend notification delivery.");
 if(env.VERCEL_ENV==="production"&&env.ENABLE_TEST_CHECKOUT==="true")failures.push("Test checkout cannot be enabled in production.");
 const key=env.SUPABASE_PUBLISHABLE_KEY??"";
 let publicKey=key.startsWith("sb_publishable_")&&key.length>20&&!/TEST_ONLY|NOT_REAL/.test(key);
 if(key.startsWith("eyJ")){try{publicKey=JSON.parse(Buffer.from(key.split(".")[1],"base64url").toString()).role==="anon";}catch{publicKey=false;}}
 if(!publicKey)failures.push("Use a Supabase publishable or legacy anon key; privileged and test keys are forbidden.");
 if(!["true","false",undefined].includes(env.SITE_INDEXABLE))failures.push("SITE_INDEXABLE must be true or false.");
 return failures;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){

 const failures=validateProductionEnv(process.env);
 if(failures.length){console.error("Production configuration invalid:\n"+failures.map(x=>"- "+x).join("\n"));process.exitCode=1;}
 else console.log("Production environment validation passed. No values printed.");
}
