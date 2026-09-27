import { readdir, readFile, writeFile } from "node:fs/promises";
async function walk(path) {
  const paths = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const p = path + "/" + entry.name;
    if (entry.isDirectory()) paths.push(...(await walk(p)));
    else paths.push(p);
  }
  return paths;
}
const files = (await walk(".next/static")).filter((f) => f.endsWith(".js"));
const forbidden = [
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_URL",
  "sb_secret_",
  "TEST_ONLY_NOT_A_REAL_KEY",
  "Incomplete Supabase catalog configuration.",
  "The catalog requires a publishable",
];
const violations = [];
for (const file of files) {
  const text = await readFile(file, "utf8");
  for (const token of forbidden)
    if (text.includes(token)) violations.push({ file, token });
}
if (violations.length) throw new Error(JSON.stringify(violations));
const sourceFiles = await walk("src");
for (const file of sourceFiles) {
  const source = await readFile(file, "utf8");
  if (/NEXT_PUBLIC.*(SERVICE|SECRET)/.test(source))
    throw new Error("Unsafe public env name: " + file);
}
const report = {
  clientChunksScanned: files.length,
  forbiddenTokens: forbidden,
  violations,
  environmentFiles: "Only .env.example supplied; no live credentials",
};
await writeFile("qa/secret-audit.json", JSON.stringify(report, null, 2));
console.log(
  "Client bundle boundary checks passed (" + files.length + " chunks).",
);
