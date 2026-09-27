import {readdir,readFile,writeFile} from "node:fs/promises";
const skip=new Set(["node_modules",".next",".git",".vercel"]);
const findings=[];let scanned=0;
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){
 if(skip.has(entry.name))continue;
 const path=dir+"/"+entry.name;
 if(entry.isDirectory()){await walk(path);continue;}
 if(!/\.(?:[cm]?[jt]sx?|json|md|sql|ya?ml|toml|txt)$/.test(path)&&!entry.name.startsWith(".env"))continue;
 const text=await readFile(path,"utf8");scanned++;
 const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,/\b(?:ghp_|github_pat_)[A-Za-z0-9_]{30,}/g,/\bAKIA[A-Z0-9]{16}\b/g,/\bsb_secret_[A-Za-z0-9_-]{16,}/g,/\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g];
 for(const pattern of patterns){for(const match of text.matchAll(pattern)){
  if(path.endsWith("/scripts/test-catalog.mjs")&&match[0]===["sb","secret","TEST_ONLY_NOT_A_REAL_KEY"].join("_"))continue;
if(path.endsWith("/scripts/test-production.mjs")&&match[0]===["sb","secret","TEST_ONLY_NOT_REAL"].join("_"))continue;
  findings.push({file:path,line:text.slice(0,match.index).split("\n").length,kind:"Possible credential; value redacted"});
 }}
 if(/NEXT_PUBLIC_[A-Z_]*(?:SECRET|SERVICE_ROLE|PASSWORD|PRIVATE_KEY)/.test(text))findings.push({file:path,kind:"Unsafe public environment name"});
}}
await walk(".");
await writeFile("qa/repository-secret-audit.json",JSON.stringify({scanned,findings,scope:"Project text files excluding dependencies, build output and Git internals; synthetic test key explicitly allowlisted."},null,2));
if(findings.length){console.error(JSON.stringify(findings));process.exit(1);}
console.log("Repository secret scan passed ("+scanned+" text files).");
