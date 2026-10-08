// Read-only heuristic scan of reachable Git text blobs. Never print secret values.
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
const git = process.env.GIT_BINARY || "git";
const objects = execFileSync(git,["rev-list","--objects","--all"],{encoding:"utf8",maxBuffer:32*1024*1024}).trim().split("\n");
const candidates = new Map();
for(const line of objects){const at=line.indexOf(" ");if(at<0)continue;const sha=line.slice(0,at),path=line.slice(at+1);if(/\.(?:[cm]?[jt]sx?|json|md|sql|ya?ml|toml|txt)$/.test(path)||/(^|\/)\.env/.test(path))candidates.set(sha,path);}
const metadata=execFileSync(git,["cat-file","--batch-check=%(objectname) %(objecttype) %(objectsize)"],{input:[...candidates.keys()].join("\n"),encoding:"utf8",maxBuffer:32*1024*1024}).trim().split("\n");
const findings=[];let scanned=0,skipped=0;
for(const line of metadata){const [sha,type,size]=line.split(" ");if(type!=="blob")continue;if(Number(size)>2*1024*1024){skipped++;continue;}const text=execFileSync(git,["cat-file","blob",sha],{encoding:"utf8",maxBuffer:3*1024*1024});scanned++;
 const patterns=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,/\b(?:ghp_|github_pat_)[A-Za-z0-9_]{30,}/g,/\bAKIA[A-Z0-9]{16}\b/g,/\bsb_secret_[A-Za-z0-9_-]{16,}/g,/\b(?:sk_live_|rk_live_|whsec_)[A-Za-z0-9]{20,}/g];
 for(const pattern of patterns)for(const match of text.matchAll(pattern)){
  if(candidates.get(sha).startsWith("scripts/test-")&&/TEST_ONLY_NOT_(?:A_REAL_KEY|REAL)/.test(match[0]))continue;
  findings.push({file:candidates.get(sha),blob:sha,line:text.slice(0,match.index).split("\n").length,kind:"Potential secret; value redacted"});
 }
}
await writeFile("qa/git-history-secret-audit.json",JSON.stringify({scope:"Reachable local refs; text blobs <=2MiB. Heuristic patterns, not proof that secrets never existed in remote/unreachable history.",scanned,skipped,findings},null,2));
console.log(`${scanned} historical text blobs scanned; ${findings.length} potential secrets; ${skipped} oversized text blobs skipped.`);
if(findings.length)process.exitCode=1;
