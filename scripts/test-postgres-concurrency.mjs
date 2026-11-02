// Real independent psql processes; ONLY a fresh loopback disposable database.
// Usage: node scripts/test-postgres-concurrency.mjs ABSOLUTE_PSQL_PATH PORT
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { TEST_BOOTSTRAP_SQL } from './database-harness.mjs';
const [psql, port] = process.argv.slice(2);
const dockerMode = process.argv[4] === '--isolated-docker';
if (!psql || !isAbsolute(psql) || (dockerMode
  ? !/^kultura-concurrency-[a-f0-9]{32}$/.test(port ?? '')
  : !/^\d+$/.test(port ?? '') || +port < 1024 || +port > 65535))
  throw Error('Explicit absolute psql path and non-privileged loopback port required');
if (dockerMode) {
  const [container] = JSON.parse(execFileSync(psql, ['--context', 'desktop-linux', 'inspect', port], { encoding: 'utf8', windowsHide: true }));
  assert.equal(container.HostConfig.NetworkMode, 'none');
  assert.equal(container.Image, 'sha256:f371b5f3f2ac0a05703f33d6e6134515fb2498cab708fb948a0aeb7481467c00');
  assert.equal(container.Config.Labels?.['kultura.test.scope'], 'synthetic-concurrency');
  assert.equal(container.Config.User, 'postgres');
  assert.equal(container.Mounts.length, 0, 'No backup or host filesystem mounts allowed');
  assert.equal(Object.keys(container.HostConfig.PortBindings ?? {}).length, 0);
  assert.equal(container.State.Running, true);
}
const database = 'kultura_concurrency_test';
function sql(query) {
  return new Promise((resolve, reject) => {
    const args = dockerMode
      ? ['--context', 'desktop-linux', 'exec', '-i', port, 'psql', '-X', '-w', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', '/tmp', '-U', 'postgres', '-d', database]
      : ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', port, '-U', 'postgres', '-d', database];
    const child = spawn(psql, args, {
      windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('PG'))),
        PGHOSTADDR: '127.0.0.1', PGPASSWORD: '', PGPASSFILE: 'NUL',
        PGOPTIONS: '-c statement_timeout=15000 -c lock_timeout=10000' },
    });
    let output = '', errors = '';
    child.stdout.on('data', b => { output += b; });
    child.stderr.on('data', b => { errors += b; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(output.trim()) : reject(Error(`Disposable PostgreSQL test failed (${code}): ${errors.slice(-2000)}`)));
    child.stdin.end("set statement_timeout='15s'; set lock_timeout='10s';\n" + query);
  });
}
const identity = JSON.parse(await sql("select json_build_object('database',current_database(),'host',inet_server_addr()::text,'empty',not exists(select 1 from information_schema.tables where table_schema='public'));"));
assert.equal(identity.database, database); assert.equal(identity.host, dockerMode ? null : '127.0.0.1'); assert.equal(identity.empty, true, 'Refuse nonempty database; never reset it');
if (dockerMode) assert.equal(await sql('show cron.launch_active_jobs;'), 'off', 'Scheduled jobs must remain disabled in the synthetic test');
await sql(TEST_BOOTSTRAP_SQL);
const migrations = (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql')).sort();
for (const migration of migrations) await sql(await readFile(`supabase/migrations/${migration}`, 'utf8'));
await sql(await readFile('supabase/seed.sql', 'utf8'));
const a = 'e89ef216-0000-4000-8000-000000000001', b = 'e89ef216-0000-4000-8000-000000000002';
await sql(`insert into auth.users(id,email) values('${a}','local-a@example.invalid'),('${b}','local-b@example.invalid');`);
const variant = JSON.parse(await sql("select row_to_json(v) from (select v.id,v.product_id,p.price from product_variants v join products p on p.id=v.product_id where p.status='active' and v.stock_quantity>=3 and v.is_active limit 1) v;"));
const cart = JSON.stringify([{ product_id: variant.product_id, variant_id: variant.id, quantity: 3 }]);
// This database is verified empty above; size only the disposable seed fixture.
await sql(`update public.product_variants set stock_quantity=30 where id='${variant.id}';`);
const address = JSON.stringify({ recipient_name: 'LOCAL TEST', phone: '000000000', city: 'Tbilisi', address_line_1: 'DO NOT SHIP' });
const key = 'e89ef216-0000-4000-8000-000000000003';
function submission(label, request, lock = false, user = a, items = cart) {
  return `begin;
set local application_name='kultura-concurrency-${label}';
create temporary table result as select pg_backend_pid() pid,clock_timestamp() started,null::timestamptz finished,null::uuid order_id;
grant select,update on result to authenticated;
${lock ? `select id from public.profiles where id='${user}' for update; select pg_sleep(4);` : ''}
set local role authenticated;
select set_config('request.jwt.claim.sub','${user}',true);
update result set order_id=checkout_submit_order('${request}','${items}'::jsonb,'${address}'::jsonb,null);
update result set finished=clock_timestamp();
commit;
select row_to_json(result) from result;`;
}
function result(output) { return JSON.parse(output.split('\n').findLast(line => line.startsWith('{'))); }
const firstPromise = sql(submission('a', key, true));
// Avoid an unhandled rejection while polling; the original promise is awaited below.
firstPromise.catch(() => {});
let observed = false;
for (let i = 0; i < 20; i++) {
  observed = (await sql("select exists(select 1 from pg_stat_activity where application_name='kultura-concurrency-a' and wait_event='PgSleep');")) === 't';
  if (observed) break;
  await new Promise(resolve => setTimeout(resolve, 100));
}
assert.ok(observed, 'First connection must demonstrably hold the profile lock before second submission');
const secondPromise = sql(submission('b', key));
const [first, second] = (await Promise.all([firstPromise, secondPromise])).map(result);
assert.notEqual(first.pid, second.pid);
assert.ok(Date.parse(second.started) < Date.parse(first.finished), 'Transactions must actually overlap');
assert.ok(Date.parse(second.finished) >= Date.parse(first.finished), 'Second submission must finish after the first releases its customer lock');
assert.equal(first.order_id, second.order_id);
assert.equal(await sql(`select count(*) from orders where customer_id='${a}';`), '1');
const replay = result(await sql(submission('retry', key))); assert.equal(replay.order_id, first.order_id);
await assert.rejects(sql(submission('conflict', key, false, a, cart.replace('"quantity":3', '"quantity":2'))), /different details/);
const other = result(await sql(submission('new', 'e89ef216-0000-4000-8000-000000000004')));
assert.notEqual(other.order_id, first.order_id);
const scoped = result(await sql(submission('customer-b', key, false, b)));
assert.notEqual(scoped.order_id, first.order_id);
const integrity = JSON.parse(await sql(`select json_build_object('orders',(select count(*) from orders where customer_id in ('${a}','${b}')),'pending',(select bool_and(payment_status='pending' and paid_at is null and subtotal=${variant.price * 3} and final_total=subtotal) from orders where customer_id in ('${a}','${b}')),'quantity',(select bool_and(quantity=3) from order_items where order_id in(select id from orders where customer_id in ('${a}','${b}'))));`));
assert.deepEqual(integrity, { orders: 3, pending: true, quantity: true });
assert.equal(await sql(`select stock_quantity from product_variants where id='${variant.id}';`), '21');
assert.equal(await sql("select count(*) from private.checkout_reservations where state='held';"), '3');
const report = { scope: 'Real local PostgreSQL, independent psql connections, fresh disposable DB; Auth/Storage SQL shim. No hosted DB, GoTrue, PostgREST or providers contacted.',
  transport: dockerMode ? 'Network-disabled disposable container / Unix socket' : 'IPv4 loopback',
  engine: await sql('select version();'), migrations, first, second,
  checks: ['Independent backend PIDs', 'Measured transaction overlap while customer profile lock held', 'Same customer/key creates exactly one order', 'Ambiguous-response retry returns existing order', 'Changed payload denied', 'New key creates legitimate new order', 'Same key scoped to another customer', 'Trusted quantity/totals and pending payment'],
  status: 'PASSED', fixtures: 'Retained only inside disposable local database until server shutdown; never real customer data' };
await writeFile('qa/postgres-concurrency-results.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
