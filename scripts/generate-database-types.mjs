import { createTestDatabase } from "./database-harness.mjs";
import { writeFile, readFile } from "node:fs/promises";
const db = await createTestDatabase({ seed: false });
try {
  const { rows: enums } = await db.query(
    `select t.typname, e.enumlabel from pg_type t join pg_enum e on e.enumtypid=t.oid join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' order by t.typname,e.enumsortorder`,
  );
  const enumNames = [...new Set(enums.map((e) => e.typname))];
  const { rows: columns } = await db.query(
    `select table_name,column_name,is_nullable,column_default,udt_name from information_schema.columns where table_schema='public' order by table_name,ordinal_position`,
  );
  const { rows: foreignKeys } =
    await db.query(`select con.conname, rel.relname as table_name, ref.relname as referenced_relation,
 array(select a.attname from unnest(con.conkey) with ordinality k(num,ord) join pg_attribute a on a.attrelid=con.conrelid and a.attnum=k.num order by k.ord) as columns,
 array(select a.attname from unnest(con.confkey) with ordinality k(num,ord) join pg_attribute a on a.attrelid=con.confrelid and a.attnum=k.num order by k.ord) as referenced_columns
 from pg_constraint con join pg_class rel on rel.oid=con.conrelid join pg_class ref on ref.oid=con.confrelid join pg_namespace ns on ns.oid=rel.relnamespace join pg_namespace rns on rns.oid=ref.relnamespace where con.contype='f' and ns.nspname='public' and rns.nspname='public' order by con.conname`);
  const tsType = (c) =>
    (enumNames.includes(c.udt_name)
      ? 'Database["public"]["Enums"]["' + c.udt_name + '"]'
      : ["int2", "int4", "int8", "numeric", "float4", "float8"].includes(
            c.udt_name,
          )
        ? "number"
        : c.udt_name === "bool"
          ? "boolean"
          : "string") + (c.is_nullable === "YES" ? " | null" : "");
  let out =
    "// Generated from executable migrations by pnpm db:types. Do not hand-edit.\n";
  out += "export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\n";
  out += "export type Database = { public: { Tables: {\n";
  for (const table of [...new Set(columns.map((c) => c.table_name))]) {
    const cols = columns.filter((c) => c.table_name === table);
    out += table + ": {\n";
    for (const mode of ["Row", "Insert", "Update"]) {
      out += mode + ": {\n";
      for (const c of cols)
        out +=
          c.column_name +
          (mode === "Update" ||
          (mode === "Insert" &&
            (c.column_default !== null || c.is_nullable === "YES"))
            ? "?"
            : "") +
          ": " +
          tsType(c) +
          ";\n";
      out += "};\n";
    }
    out +=
      "Relationships: [" +
      foreignKeys
        .filter((f) => f.table_name === table)
        .map((f) =>
          JSON.stringify({
            foreignKeyName: f.conname,
            columns: f.columns,
            isOneToOne: false,
            referencedRelation: f.referenced_relation,
            referencedColumns: f.referenced_columns,
          }),
        )
        .join(",") +
      "];\n};\n";
  }
  out +=
    "}; Views: { [_ in never]: never }; Functions: {\n";
  const {rows:functions}=await db.query("select p.proname,p.proargnames,array(select t.typname from unnest(p.proargtypes) with ordinality a(oid,n) join pg_type t on t.oid=a.oid order by a.n) argtypes,r.typname result from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_type r on r.oid=p.prorettype where n.nspname='public' order by p.proname");
  const argType=t=>t==="jsonb"?"Json":t==="_uuid"?"string[]":t==="void"?"undefined":t==="bool"?"boolean":"string";
  for(const f of functions)out+=f.proname+": { Args: { "+f.proargnames.map((name,i)=>name+": "+argType(f.argtypes[i])+" | null").join("; ")+" }; Returns: "+argType(f.result)+" };\n";
  out+="}; Enums: {\n";
  for (const name of enumNames)
    out +=
      name +
      ": " +
      enums
        .filter((e) => e.typname === name)
        .map((e) => JSON.stringify(e.enumlabel))
        .join(" | ") +
      ";\n";
  out += "}; CompositeTypes: { [_ in never]: never }; }; };\n";
  const path = "src/lib/supabase/database.types.ts";
  if (process.argv.includes("--check")) {
    if ((await readFile(path, "utf8")) !== out)
      throw new Error("Database types are stale. Run pnpm db:types.");
    console.log("Database types match migrations.");
  } else {
    await writeFile(path, out);
    console.log("Generated " + path);
  }
} finally {
  await db.close();
}
