import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./database-harness.mjs";
import { dropTime, dropTimeInput, remainingPieces } from "../src/lib/drops.ts";
import { chooseLocale } from "../src/lib/locale-preference.ts";

const db = await createTestDatabase({ seed: false });
const release = randomUUID(), draft = randomUUID(), admin = randomUUID(), customer = randomUUID(), stranger = randomUUID();
const checks = [];
async function check(name, run) {
  await run();
  checks.push(name);
}
async function queryAs(role, user, sql, params = []) {
  await db.exec(`begin; set local role ${role}`);
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user ?? ""]);
    const result = await db.query(sql, params);
    await db.exec("commit");
    return result.rows;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}
try {
  for (const [id, name] of [[admin, "admin"], [customer, "customer"], [stranger, "stranger"]]) {
    await db.query("insert into auth.users(id,email,email_confirmed_at) values ($1,$2,now())", [id, name + "@example.invalid"]);
  }
  await db.query("update public.profiles set role='admin' where id=$1", [admin]);
  const [{ id: category }] = (await db.query("insert into public.categories(name,slug,is_active) values ('Drop Test','drop-test',true) returning id")).rows;
  const [{ id: product }] = (await db.query("insert into public.products(category_id,name,slug,status,price) values ($1,'Drop sample','drop-sample','active',4000) returning id", [category])).rows;
  await queryAs("authenticated", admin, "insert into public.drop_releases(id,title,launches_at,published) values ($1,'Next release',now() + interval '1 hour',true),($2,'Draft release',now() + interval '1 hour',false)", [release, draft]);
  await queryAs("authenticated", admin, "insert into public.drop_release_products(release_id,product_id) values ($1,$2)", [release, product]);

  await check("Georgian browser preference and explicit links resolve predictably", () => {
    assert.equal(chooseLocale(null, null, "ka-GE, en;q=0.8"), "ka");
    assert.equal(chooseLocale(null, null, "en, ka;q=0.8"), "en");
    assert.equal(chooseLocale(null, "en", "ka"), "en");
    assert.equal(chooseLocale("ka", "en", "en"), "ka");
  });
  await check("Georgia launch time round trips and stock is drawn from active variants", () => {
    assert.equal(dropTime("2026-12-18T18:30"), "2026-12-18T14:30:00.000Z");
    assert.equal(dropTimeInput("2026-12-18T14:30:00.000Z"), "2026-12-18T18:30");
    assert.equal(dropTime("2026-02-30T12:00"), null);
    assert.equal(remainingPieces({ variants: [{ stock: 7 }, { stock: 5 }] }), 12);
  });
  await check("The public sees the published schedule and product links open at launch", async () => {
    assert.deepEqual((await queryAs("anon", null, "select id from public.drop_releases")).map(row => row.id), [release]);
    assert.equal((await queryAs("anon", null, "select product_id from public.drop_release_products")).length, 0);
    assert.equal((await queryAs("authenticated", admin, "select product_id from public.drop_release_products")).length, 1);
  });
  await check("An alert is private, self-owned, unique, and available only before launch", async () => {
    const insert = "insert into public.drop_alerts(release_id,user_id,locale) values ($1,$2,'ka')";
    await queryAs("authenticated", customer, insert, [release, customer]);
    await assert.rejects(queryAs("authenticated", customer, insert, [release, customer]), { code: "23505" });
    await assert.rejects(queryAs("authenticated", customer, insert, [draft, customer]), { code: "42501" });
    await assert.rejects(queryAs("authenticated", customer, insert, [release, stranger]), { code: "42501" });
    assert.equal((await queryAs("authenticated", stranger, "select release_id from public.drop_alerts")).length, 0);
    await assert.rejects(queryAs("anon", null, "select release_id from public.drop_alerts"), { code: "42501" });
  });
  await check("Delivery can only claim due alerts, and a leased alert cannot be claimed twice", async () => {
    const claim = "select public.claim_drop_alerts($1) as alerts";
    assert.deepEqual((await queryAs("service_role", null, claim, [release]))[0].alerts, []);
    await assert.rejects(queryAs("authenticated", admin, claim, [release]), { code: "42501" });
    await queryAs("authenticated", admin, "update public.drop_releases set launches_at=now()-interval '1 minute' where id=$1", [release]);
    assert.equal((await queryAs("anon", null, "select product_id from public.drop_release_products")).length, 1);
    const [{ alerts }] = await queryAs("service_role", null, claim, [release]);
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].locale, "ka");
    assert.deepEqual((await queryAs("service_role", null, claim, [release]))[0].alerts, []);
    await queryAs("service_role", null, "update public.drop_alerts set sent_at=now() where id=$1", [alerts[0].id]);
    await assert.rejects(queryAs("authenticated", stranger, "insert into public.drop_alerts(release_id,user_id,locale) values ($1,$2,'en')", [release, stranger]), { code: "42501" });
  });
} finally {
  await db.close();
}
console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
