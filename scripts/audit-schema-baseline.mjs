// Offline comparison only: never connects to a hosted database or writes history.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createTestDatabase } from './database-harness.mjs';
const paths = process.argv.slice(2);
if (paths.length !== 2) throw Error('Provide staging and production schema-only snapshot paths');
const snapshots = await Promise.all(paths.map(async p => JSON.parse(await readFile(p, 'utf8'))));
if (snapshots[0].project_ref !== 'fpahkxmlcvywspamftma' || snapshots[1].project_ref !== 'asnkxfudkodgyhdawhfq') throw Error('Snapshot identity mismatch');
const db = await createTestDatabase({ seed: false, through: '0' });
const normalize = value => JSON.stringify(value).replaceAll('\\r', '');
const body = definition => definition.match(/AS (\$[a-z_]*\$)([\s\S]*?)\1/i)?.[2]?.replaceAll('\r', '').trim() ?? definition;
function objects(s) {
  const result = new Map();
  for (const c of s.columns) result.set(`column:${c.table_schema}.${c.table_name}.${c.column_name}`, normalize([c.udt_name,c.is_nullable,c.column_default]));
  for (const i of s.indexes) result.set(`index:${i.schemaname}.${i.indexname}`, i.indexdef);
  for (const p of s.policies) result.set(`policy:${p.schemaname}.${p.tablename}.${p.policyname}`, normalize([p.cmd,p.qual,p.roles,p.permissive,p.with_check]));
  for (const t of s.triggers) result.set(`trigger:${t.table}.${t.name}`, t.definition);
  for (const f of s.functions) result.set(`function:${f.signature}`, body(f.definition));
  // PG18 catalogs NOT NULL constraints separately; PG17 stores attnotnull.
  // Column is_nullable above is the portable enforcement comparison.
  for (const c of s.constraints) if (!/^NOT NULL\b/.test(c.definition)) result.set(`constraint:${c.table}.${c.name}`, c.definition);
  return result;
}
async function capture() {
  const query = async sql => (await db.query(sql)).rows;
  return {
    columns: await query("select * from information_schema.columns where table_schema in ('public','private')"),
    indexes: await query("select * from pg_indexes where schemaname in ('public','private')"),
    policies: await query("select * from pg_policies where schemaname in ('public','private','storage')"),
    triggers: await query("select t.tgname name,c.relname as table,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in ('public','private')"),
    functions: await query("select p.oid::regprocedure::text signature,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')"),
    constraints: await query("select con.conname name,c.oid::regclass::text as table,pg_get_constraintdef(con.oid) definition from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private')"),
  };
}
try {
  let previous = objects(await capture());
  const migrations = [];
  for (const filename of (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort()) {
    const sql = await readFile(`supabase/migrations/${filename}`, 'utf8');
    await db.exec(sql);
    const current = objects(await capture());
    migrations.push({ filename, sha256: createHash('sha256').update(sql).digest('hex'), affected_objects: [...current.keys()].filter(k => current.get(k) !== previous.get(k)) });
    previous = current;
  }
  const environments = snapshots.map(snapshot => {
    const hosted = objects(snapshot);
    const missing = [...previous.keys()].filter(k => !hosted.has(k));
    const differing = [...previous.keys()].filter(k => hosted.has(k) && hosted.get(k) !== previous.get(k));
    const additional = [...hosted.keys()].filter(k => !previous.has(k));
    return { project_ref: snapshot.project_ref, snapshot_scope: snapshot.scope,
      missing, differing, additional,
      migrations: migrations.map(m => ({ ...m, affected_objects: undefined,
        represented_objects: m.affected_objects.filter(k => hosted.has(k)).length,
        missing_objects: m.affected_objects.filter(k => missing.includes(k)),
        final_definition_drift: m.affected_objects.filter(k => differing.includes(k)),
        history_action: 'NOT_RECORDED: object presence is not proof that original SQL executed',
      })) };
  });
  const report = { scope: 'Offline schema comparison against fresh executable migration chain. See each snapshot_scope for capture timing; this is not live monitoring.',
    limitations: ['No hosted writes or migration history changes.', 'Function bodies compared after CRLF normalization; owners, grants, RLS flags and auth/storage objects require separate hosted review.', 'PG version differences in named NOT NULL constraints may produce differences; never auto-repair based on this report.', 'No-op/data-only migrations cannot be certified from object presence.', 'Do not replay or backfill historical migrations from this report alone.'], environments };
  await writeFile('qa/schema-baseline-comparison.json', JSON.stringify(report, null, 2) + '\n');
  for (const e of environments) console.log(JSON.stringify({project_ref:e.project_ref,missing:e.missing.length,differing:e.differing.length,additional:e.additional.length,migrations:e.migrations.length}));
} finally { await db.close(); }
