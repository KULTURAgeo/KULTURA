import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createTestDatabase } from './database-harness.mjs';

const db = await createTestDatabase({ seed: false });
const admin = randomUUID();
const customer = randomUUID();
const checks = [];

async function check(name, run) {
  await run();
  checks.push(name);
}

async function asRole(role, userId, sql, values = [], claims = { aal: 'aal2' }) {
  await db.exec(`begin; set local role ${role};`);
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? '']);
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    const result = await db.query(sql, values);
    await db.exec('commit;');
    return result;
  } catch (error) {
    await db.exec('rollback;');
    throw error;
  }
}

const adminQuery = (sql, values) => asRole('authenticated', admin, sql, values);
const customerQuery = (sql, values) => asRole('authenticated', customer, sql, values);
const publicQuery = (sql, values) => asRole('anon', null, sql, values);

try {
  await db.query('insert into auth.users(id,email) values ($1,$2),($3,$4)', [
    admin, 'showroom-admin@example.invalid', customer, 'showroom-customer@example.invalid',
  ]);
  await db.query("update public.profiles set role='admin' where id=$1", [admin]);
  const category = (await db.query("insert into public.categories(name,slug,is_active) values ('QA Accessories','qa-accessories',true) returning id")).rows[0].id;
  const inactiveCategory = (await db.query("insert into public.categories(name,slug,is_active) values ('QA Hidden','qa-hidden',false) returning id")).rows[0].id;
  const activeProduct = (await db.query("insert into public.products(name,slug,price,category_id,status) values ('QA Piece','qa-piece',7900,$1,'active') returning id", [category])).rows[0].id;
  const draftProduct = (await db.query("insert into public.products(name,slug,price,category_id,status) values ('QA Draft','qa-draft',7900,$1,'draft') returning id", [category])).rows[0].id;
  const inactiveCategoryProduct = (await db.query("insert into public.products(name,slug,price,category_id,status) values ('QA Hidden Piece','qa-hidden-piece',7900,$1,'active') returning id", [inactiveCategory])).rows[0].id;

  await check('Auto mode exposes settings while keeping curated rows private', async () => {
    const settings = await publicQuery('select use_custom_items from public.homepage_showroom_settings');
    assert.equal(settings.rows[0].use_custom_items, false);
    assert.equal((await publicQuery('select id from public.homepage_showroom_items')).rows.length, 0);
  });

  let productCard;
  await check('Admin without a verified second factor cannot write through RLS or admin RPCs', async () => {
    for (const claims of [{}, { aal: 'aal1' }]) {
      await assert.rejects(asRole('authenticated', admin,
        "insert into public.homepage_showroom_items(source_kind,category_id) values ('category',$1)",
        [category], claims), error => error.code === '42501');
      await assert.rejects(asRole('authenticated', admin,
        'select public.admin_save_checkout_settings(1000, 10000)', [], claims),
        error => error.code === '42501');
    }
  });
  await check('Admin creates product and category cards with a stable ordered list', async () => {
    productCard = (await adminQuery("insert into public.homepage_showroom_items(source_kind,product_id,title,sort_position) values ('product',$1,'QA Product',20) returning id,updated_at", [activeProduct])).rows[0];
    await adminQuery("insert into public.homepage_showroom_items(source_kind,category_id,title,sort_position) values ('category',$1,'QA Category',10)", [category]);
    assert.equal((await adminQuery('select id from public.homepage_showroom_items')).rows.length, 2);
    assert.equal((await publicQuery('select id from public.homepage_showroom_items')).rows.length, 0);
    await adminQuery('update public.homepage_showroom_settings set use_custom_items=true where singleton');
    assert.deepEqual((await publicQuery('select title from public.homepage_showroom_items order by sort_position,id')).rows.map(row => row.title), ['QA Category', 'QA Product']);
  });

  await check('Anonymous and customer users cannot change cards or the mode', async () => {
    await assert.rejects(publicQuery("insert into public.homepage_showroom_items(source_kind,category_id) values ('category',$1)", [category]), error => error.code === '42501');
    await assert.rejects(customerQuery("insert into public.homepage_showroom_items(source_kind,category_id) values ('category',$1)", [category]), error => error.code === '42501');
    await customerQuery("update public.homepage_showroom_items set title='Tampered'");
    await customerQuery('delete from public.homepage_showroom_items');
    await customerQuery('update public.homepage_showroom_settings set use_custom_items=false');
    assert.equal((await publicQuery('select use_custom_items from public.homepage_showroom_settings')).rows[0].use_custom_items, true);
    assert.equal((await adminQuery("select count(*)::int as n from public.homepage_showroom_items where title='Tampered'")).rows[0].n, 0);
    assert.equal((await adminQuery('select id from public.homepage_showroom_items')).rows.length, 2);
  });

  await check('Inactive cards, draft products and inactive categories are not publicly exposed', async () => {
    await adminQuery("insert into public.homepage_showroom_items(source_kind,product_id,title) values ('product',$1,'Secret draft')", [draftProduct]);
    await adminQuery("insert into public.homepage_showroom_items(source_kind,category_id,title) values ('category',$1,'Secret category')", [inactiveCategory]);
    await adminQuery("insert into public.homepage_showroom_items(source_kind,product_id,title) values ('product',$1,'Secret source')", [inactiveCategoryProduct]);
    await adminQuery("insert into public.homepage_showroom_items(source_kind,category_id,title,is_active) values ('category',$1,'Secret inactive',false)", [category]);
    assert.equal((await adminQuery('select id from public.homepage_showroom_items')).rows.length, 6);
    assert.equal((await publicQuery('select id from public.homepage_showroom_items')).rows.length, 2);
    assert.equal((await customerQuery('select id from public.homepage_showroom_items')).rows.length, 2);
  });

  await check('Source-kind constraints reject contradictory and missing source IDs', async () => {
    await assert.rejects(adminQuery("insert into public.homepage_showroom_items(source_kind,product_id,category_id) values ('product',$1,$2)", [activeProduct, category]), error => error.code === '23514');
    await assert.rejects(adminQuery("insert into public.homepage_showroom_items(source_kind) values ('category')"), error => error.code === '23514');
  });

  await check('Optimistic version checks preserve a newer card edit', async () => {
    const edited = (await adminQuery("update public.homepage_showroom_items set title='Latest title',sort_position=3 where id=$1 and updated_at=$2 returning updated_at", [productCard.id, productCard.updated_at])).rows[0];
    assert.ok(edited);
    const stale = await adminQuery("update public.homepage_showroom_items set title='Stale edit' where id=$1 and updated_at=$2 returning id", [productCard.id, productCard.updated_at]);
    assert.equal(stale.rows.length, 0);
    assert.equal((await adminQuery('select title from public.homepage_showroom_items where id=$1', [productCard.id])).rows[0].title, 'Latest title');
  });

  await check('Showroom uploads are scoped to the card and require an MFA admin', async () => {
    const file = randomUUID();
    const path = `showroom/${productCard.id}/${file}.webp`;
    const storageInsert = "insert into storage.objects(bucket_id,name) values ('product-images',$1)";
    await assert.rejects(customerQuery(storageInsert, [path]), error => error.code === '42501');
    await assert.rejects(asRole('authenticated', admin, storageInsert, [path], { aal: 'aal1' }), error => error.code === '42501');
    await assert.rejects(adminQuery(storageInsert, [path.replace('.webp', '.png')]), error => error.code === '42501');
    await adminQuery(storageInsert, [path]);
    const link = 'update public.homepage_showroom_items set image_path=$1 where id=$2';
    await assert.rejects(adminQuery(link, [`showroom/${randomUUID()}/${file}.webp`, productCard.id]), error => error.code === '23514');
    await adminQuery(link, [path, productCard.id]);
    assert.equal((await publicQuery('select image_path from public.homepage_showroom_items where id=$1', [productCard.id])).rows[0].image_path, path);
  });

  await check('Twelve cards are supported and the database rejects a thirteenth', async () => {
    for (let index = 6; index < 12; index++) await adminQuery("insert into public.homepage_showroom_items(source_kind,category_id,title) values ('category',$1,$2)", [category, `Extra ${index}`]);
    await assert.rejects(adminQuery("insert into public.homepage_showroom_items(source_kind,category_id,title) values ('category',$1,'Thirteenth')", [category]), error => error.code === '23514');
    assert.equal((await adminQuery('select id from public.homepage_showroom_items')).rows.length, 12);
  });

  await check('Deleting a selected source removes its card, deleting an image source preserves it', async () => {
    await adminQuery('delete from public.homepage_showroom_items where title like $1', ['Extra %']);
    const imageProduct = (await db.query("insert into public.products(name,slug,price,category_id,status) values ('QA Photo','qa-photo',4900,$1,'active') returning id", [category])).rows[0].id;
    await adminQuery('update public.homepage_showroom_items set image_product_id=$1 where id=$2', [imageProduct, productCard.id]);
    await db.query('delete from public.products where id=$1', [imageProduct]);
    assert.equal((await adminQuery('select image_product_id from public.homepage_showroom_items where id=$1', [productCard.id])).rows[0].image_product_id, null);
    await db.query('delete from public.products where id=$1', [activeProduct]);
    assert.equal((await adminQuery('select id from public.homepage_showroom_items where id=$1', [productCard.id])).rows.length, 0);
  });

  await check('Custom mode remains intentionally empty after all items are removed', async () => {
    await adminQuery('delete from public.homepage_showroom_items');
    assert.equal((await publicQuery('select use_custom_items from public.homepage_showroom_settings')).rows[0].use_custom_items, true);
    assert.equal((await publicQuery('select id from public.homepage_showroom_items')).rows.length, 0);
  });

  const report = { status: 'PASSED', scope: 'Disposable local PostgreSQL (PGlite), actual migrations and RLS policies, synthetic records only', checks };
  await writeFile(new URL('../qa/showroom-database-results.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await db.close();
}
