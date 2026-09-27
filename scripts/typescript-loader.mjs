// Run source-level tests with the existing TypeScript compiler in-process.
// No additional compiler binary or bundler service is required.
import {registerHooks} from "node:module";
import {readFileSync,existsSync} from "node:fs";
import {fileURLToPath} from "node:url";
import ts from "typescript";
registerHooks({
 resolve(specifier,context,nextResolve){
  if((specifier.startsWith("./")||specifier.startsWith("../"))&&context.parentURL?.startsWith("file:")){
   const url=new URL(specifier,context.parentURL);
   if(!/\.[a-z]+$/i.test(url.pathname)){
    for(const suffix of [".ts",".tsx"]){const candidate=new URL(url.href+suffix);if(existsSync(candidate))return nextResolve(candidate.href,context);}
   }
  }
  return nextResolve(specifier,context);
 },
 load(url,context,nextLoad){
  if(url.startsWith("file:")&&/\.tsx?$/.test(new URL(url).pathname)){
   const source=readFileSync(new URL(url),"utf8");
   return {format:"module",shortCircuit:true,source:ts.transpileModule(source,{fileName:fileURLToPath(url),compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,verbatimModuleSyntax:true}}).outputText};
  }
  return nextLoad(url,context);
 }
});
