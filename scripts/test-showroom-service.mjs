import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Exercise application services and the real Supabase SDK. The only HTTP adapter
// translates the small PostgREST subset used here into SQL against disposable PGlite.
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoDirectory = resolve(scriptDirectory, "..");
process.chdir(repoDirectory);
const requireFromRepo = createRequire(resolve(repoDirectory, "package.json"));
const ts = requireFromRepo("typescript");
const sharp = requireFromRepo("sharp");
globalThis.__showroomInvalidations = [];
globalThis.__showroomHeaders = new Headers({
  origin: "https://showroom.example.invalid", host: "showroom.example.invalid", "sec-fetch-site": "same-origin",
});
const users = new Map();
let actor = null;
const publishableKey = "sb_publishable_SHOWROOM_SYNTHETIC";
const supabaseUrl = "https://showroom-fixture.supabase.co";
const tokenFor = id => [
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
  Buffer.from(JSON.stringify({ sub: id, aud: "authenticated", role: "authenticated", aal: "aal2", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url"),
  Buffer.from("fixture signature").toString("base64url"),
].join(".");
globalThis.__showroomCookies = {
  getAll() {
    if (!actor) return [];
    const session = {
      access_token: tokenFor(actor), refresh_token: "SYNTHETIC_REFRESH", token_type: "bearer", expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, user: users.get(actor),
    };
    return [{ name: "sb-showroom-fixture-auth-token", value: "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url") }];
  },
  set() {},
};

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { shortCircuit: true, url: "data:text/javascript,export{}" };
    if (specifier === "next/headers") return {
      shortCircuit: true,
      url: "data:text/javascript,export async function cookies(){return globalThis.__showroomCookies}export async function headers(){return globalThis.__showroomHeaders}",
    };
    if (specifier === "next/cache") return {
      shortCircuit: true,
      url: "data:text/javascript,export const unstable_cache=(fn)=>fn;export const updateTag=(tag)=>globalThis.__showroomInvalidations.push({tag});export const revalidatePath=(path,type)=>globalThis.__showroomInvalidations.push({path,type})",
    };
    if (specifier === "next/navigation") return { shortCircuit: true, url: "data:text/javascript,export function redirect(url){throw Object.assign(new Error('redirect'),{redirectTo:url})}" };
    if (specifier.startsWith("@/")) return next(pathToFileURL(resolve(repoDirectory, "src", specifier.slice(2) + ".ts")).href, context);
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && context.parentURL?.startsWith("file:")) {
      const url = new URL(specifier, context.parentURL);
      if (!/\.[a-z]+$/i.test(url.pathname) && existsSync(new URL(url.href + ".ts"))) {
        return next(url.href + ".ts", context);
      }
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith("file:") && url.endsWith(".ts")) return {
      format: "module", shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        fileName: fileURLToPath(url),
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: true },
      }).outputText,
    };
    return next(url, context);
  },
});

process.env.SUPABASE_URL = supabaseUrl;
process.env.SUPABASE_PUBLISHABLE_KEY = publishableKey;
process.env.SITE_URL = "https://showroom.example.invalid";
process.env.NODE_ENV = "development";
delete process.env.VERCEL;
for (const key of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "RATE_LIMIT_HMAC_KEY"]) delete process.env[key];

const { createTestDatabase } = await import(pathToFileURL(resolve(repoDirectory, "scripts/database-harness.mjs")).href);
const db = await createTestDatabase({ seed: true });
const { rows: columnRows } = await db.query("select table_name,column_name from information_schema.columns where table_schema='public'");
const columns = new Map();
for (const { table_name: table, column_name: column } of columnRows) {
  if (!columns.has(table)) columns.set(table, new Set());
  columns.get(table).add(column);
}
const permittedTables = new Set(["profiles", "categories", "products", "product_images", "homepage_showroom_settings", "homepage_showroom_items"]);
const requests = [];
const uploaded = new Set();
let forcedFailure = null;
let serial = Promise.resolve();
const originalFetch = globalThis.fetch;
const originalError = console.error;
const errors = [];
console.error = (...values) => errors.push(values.map(String).join(" "));

function response(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function identity(headers) {
  const auth = new Headers(headers).get("authorization")?.replace(/^Bearer /, "");
  if (!auth || auth === publishableKey) return null;
  const claims = JSON.parse(Buffer.from(auth.split(".")[1], "base64url").toString());
  assert(users.has(claims.sub), "Only synthetic sessions may access the adapter");
  return claims.sub;
}

function column(table, name, alias = "t") {
  assert(columns.get(table)?.has(name), `Unexpected column ${table}.${name}`);
  return `${alias}."${name}"`;
}

function splitSelection(selection) {
  const parts = [];
  let depth = 0, start = 0;
  for (let index = 0; index < selection.length; index++) {
    if (selection[index] === "(") depth++;
    else if (selection[index] === ")") depth--;
    else if (selection[index] === "," && depth === 0) {
      parts.push(selection.slice(start, index)); start = index + 1;
    }
  }
  return [...parts, selection.slice(start)];
}

function projection(table, selection) {
  if (selection === "*") return "to_jsonb(t)";
  return `jsonb_build_object(${splitSelection(selection).flatMap(field => {
    if (field.startsWith("product_images(")) {
      assert.equal(table, "products");
      const imageFields = field.slice("product_images(".length, -1).split(",");
      const imageObject = `jsonb_build_object(${imageFields.flatMap(name => [`'${name}'`, column("product_images", name, "im")]).join(",")})`;
      return ["'product_images'", `(select coalesce(jsonb_agg(${imageObject}), '[]'::jsonb) from public.product_images im where im.product_id=t.id)`];
    }
    return [`'${field}'`, column(table, field)];
  }).join(",")})`;
}

async function requestSQL(url, init, uid) {
  const table = url.pathname.slice("/rest/v1/".length);
  assert(permittedTables.has(table), `Unexpected table ${table}`);
  if (forcedFailure?.table === table) return response({ code: forcedFailure.code, message: "SYNTHETIC PRIVATE DATABASE ERROR" }, 503);
  const params = [];
  const bind = value => { params.push(value); return `$${params.length}`; };
  const filters = [];
  for (const [name, filter] of url.searchParams) {
    if (["select", "order", "limit", "offset"].includes(name)) continue;
    const field = column(table, name);
    if (filter.startsWith("eq.")) filters.push(`${field}=${bind(filter.slice(3))}`);
    else if (filter.startsWith("in.(")) {
      const values = filter.slice(4, -1).split(",").map(value => value.replace(/^"|"$/g, ""));
      filters.push(`${field} in (${values.map(bind).join(",")})`);
    } else throw new Error(`Unexpected filter ${name}`);
  }
  const where = filters.length ? `where ${filters.join(" and ")}` : "";
  const select = projection(table, url.searchParams.get("select") || "*");
  const method = init.method || "GET";
  let sql;
  if (method === "GET") {
    const order = (url.searchParams.get("order") || "").split(",").filter(Boolean)
      .map(item => { const [name, direction] = item.split("."); assert(["asc", "desc"].includes(direction)); return `${column(table, name)} ${direction}`; });
    const limit = url.searchParams.get("limit");
    const offset = url.searchParams.get("offset");
    sql = `select ${select} as record from public."${table}" t ${where}`
      + (order.length ? ` order by ${order.join(",")}` : "")
      + (limit ? ` limit ${bind(Number(limit))}` : "")
      + (offset ? ` offset ${bind(Number(offset))}` : "");
  } else if (method === "POST") {
    const body = JSON.parse(init.body);
    const fields = Object.keys(body);
    fields.forEach(name => column(table, name));
    sql = `with changed as (insert into public."${table}" (${fields.map(name => `"${name}"`).join(",")}) values (${fields.map(name => bind(body[name])).join(",")}) returning *) select ${select} as record from changed t`;
  } else if (method === "PATCH") {
    const body = JSON.parse(init.body);
    const assignments = Object.entries(body).map(([name, value]) => {
      column(table, name); return `"${name}"=${bind(value)}`;
    });
    sql = `with changed as (update public."${table}" t set ${assignments.join(",")} ${where} returning *) select ${select} as record from changed t`;
  } else if (method === "DELETE") {
    sql = `with changed as (delete from public."${table}" t ${where} returning *) select ${select} as record from changed t`;
  } else throw new Error(`Unexpected method ${method}`);

  await db.exec(`begin;set local role ${uid ? "authenticated" : "anon"}`);
  try {
    if (uid) await db.query("select set_config('request.jwt.claim.sub',$1,true)", [uid]);
    const { rows } = await db.query(sql, params);
    await db.exec("commit");
    const records = rows.map(row => row.record);
    const singleton = new Headers(init.headers).get("accept")?.includes("vnd.pgrst.object+json");
    if (singleton && records.length !== 1) return response({ code: "PGRST116", message: "Expected exactly one row", details: null, hint: null }, 406);
    return response(singleton ? records[0] : records, method === "POST" ? 201 : 200);
  } catch (error) {
    await db.exec("rollback");
    return response({ code: error.code, message: error.message, details: null, hint: null }, error.code === "42501" ? 403 : 400);
  }
}

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url ?? input);
  assert.equal(url.origin, supabaseUrl, "The test never accesses hosted services");
  const uid = identity(init.headers);
  requests.push({ path: url.pathname, method: init.method || "GET" });
  if (url.pathname === "/auth/v1/user") return uid ? response(users.get(uid)) : response({ message: "Missing synthetic session" }, 401);
  const storageBase = "/storage/v1/object/product-images";
  if (url.pathname.startsWith(storageBase + "/") && init.method === "POST") {
    assert(uid);
    const path = url.pathname.slice(storageBase.length + 1);
    const metadata = await sharp(init.body).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width * 5, metadata.height * 4);
    uploaded.add(path);
    return response({ Key: "product-images/" + path });
  }
  if (url.pathname === storageBase && init.method === "DELETE") {
    assert(uid);
    for (const path of JSON.parse(init.body).prefixes) uploaded.delete(path);
    return response([]);
  }
  assert(url.pathname.startsWith("/rest/v1/"), `Unexpected fixture request ${url.pathname}`);
  const task = serial.then(() => requestSQL(url, init, uid));
  serial = task.catch(() => {});
  return task;
};

const { loadHomepageShowroom } = await import(pathToFileURL(resolve(repoDirectory, "src/lib/showroom/repository.ts")).href);
const { saveShowroomSettings, saveShowroomItem, deleteShowroomItem } = await import(pathToFileURL(resolve(repoDirectory, "src/app/admin/showroom/actions.ts")).href);
const { showroomImage } = await import(pathToFileURL(resolve(repoDirectory, "src/lib/showroom/model.ts")).href);
const checks = [];
async function check(name, fn) { await fn(); checks.push(name); }
const form = values => { const data = new FormData(); for (const [key, value] of Object.entries(values)) if (value !== null) data.set(key, String(value)); return data; };
const settings = async () => (await db.query("select to_jsonb(s) as record from public.homepage_showroom_settings s")).rows[0].record;
const row = async id => (await db.query("select to_jsonb(i) as record from public.homepage_showroom_items i where id=$1", [id])).rows[0]?.record;
function expectInvalidation() {
  assert.deepEqual(globalThis.__showroomInvalidations.splice(0), [
    { tag: "homepage-showroom" }, { path: "/admin/showroom", type: undefined }, { path: "/", type: "page" },
  ]);
}

try {
  const adminId = randomUUID(), customerId = randomUUID();
  for (const [id, email] of [[adminId, "showroom-admin@example.invalid"], [customerId, "showroom-customer@example.invalid"]]) {
    await db.query("insert into auth.users(id,email) values($1,$2)", [id, email]);
    users.set(id, { id, email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });
  }
  await db.query("update public.profiles set role='admin' where id=$1", [adminId]);
  const { rows: products } = await db.query("select id,name,slug,category_id from public.products order by id");
  const product = products[0], secondProduct = products[1];

  await check("Public automatic mode and missing schema preserve default showroom", async () => {
    assert.equal(await loadHomepageShowroom(), undefined);
    forcedFailure = { table: "homepage_showroom_settings", code: "PGRST205" };
    assert.equal(await loadHomepageShowroom(), undefined);
    forcedFailure = null;
  });
  await check("Actual admin action rejects anonymous, customer and foreign-origin writes", async () => {
    for (const user of [null, customerId]) {
      actor = user;
      const result = await saveShowroomSettings({}, form({ updated_at: (await settings()).updated_at, use_custom_items: "on" }));
      assert.equal(result.ok, false);
    }
    actor = adminId;
    const before = requests.length;
    globalThis.__showroomHeaders.set("origin", "https://foreign.example.invalid");
    assert.equal((await saveShowroomItem({}, form({ source_kind: "product", product_id: product.id, sort_position: 0 }))).ok, false);
    assert.equal(requests.length, before);
    globalThis.__showroomHeaders.set("origin", "https://showroom.example.invalid");
    assert.equal(globalThis.__showroomInvalidations.length, 0);
  });
  await check("Display mode action persists and custom empty configuration stays empty", async () => {
    actor = adminId;
    assert.equal((await saveShowroomSettings({}, form({ updated_at: (await settings()).updated_at, use_custom_items: "on" }))).ok, true);
    expectInvalidation();
    assert.deepEqual(await loadHomepageShowroom(), []);
  });
  await check("Actual card actions reject unknown fields, duplicates and invalid source input", async () => {
    const valid = { source_kind: "product", product_id: product.id, sort_position: 5, is_active: "on" };
    const duplicate = form(valid); duplicate.append("sort_position", "2");
    const cases = [duplicate, form({ ...valid, href: "https://foreign.example.invalid" }), form({ ...valid, source_kind: "custom" }), form({ ...valid, product_id: "bad" }), form({ ...valid, title: "X".repeat(121) })];
    for (const data of cases) assert.equal((await saveShowroomItem({}, data)).ok, false);
    assert.equal((await db.query("select count(*)::int count from public.homepage_showroom_items")).rows[0].count, 0);
    assert.equal(globalThis.__showroomInvalidations.length, 0);
  });
  let productItem, categoryItem;
  await check("Product card creation reaches SQL then public loader maps trusted image and route", async () => {
    const result = await saveShowroomItem({}, form({ source_kind: "product", product_id: product.id, title: "Selected piece", title_ka: "არჩეული ნივთი", description: "Featured in the orbit", sort_position: 5, is_active: "on" }));
    assert.equal(result.ok, true, result.message); expectInvalidation();
    const [card] = await loadHomepageShowroom();
    productItem = await row(card.id);
    assert.equal(card.title, "Selected piece");
    assert.equal(card.titleKa, "არჩეული ნივთი");
    assert.equal(card.href, `/product/${product.slug}`);
    assert.match(card.image, /^\/images\//);
  });
  await check("Category card uses explicit existing product photograph and display order", async () => {
    const result = await saveShowroomItem({}, form({ source_kind: "category", category_id: product.category_id, image_product_id: secondProduct.id, sort_position: 1, is_active: "on" }));
    assert.equal(result.ok, true, result.message); expectInvalidation();
    const cards = await loadHomepageShowroom();
    categoryItem = await row(cards[0].id);
    assert.equal(cards[0].kind, "category");
    assert.match(cards[0].href, /^\/shop\//);
    const expectedImage = (await db.query("select image_url from public.product_images where product_id=$1 order by sort_position limit 1", [secondProduct.id])).rows[0].image_url;
    assert.equal(cards[0].image, expectedImage);
    assert.equal(cards[1].id, productItem.id);
  });
  await check("Editing, stale edit rejection and stale deletion use database versions", async () => {
    const result = await saveShowroomItem({}, form({ ...productItem, created_at: null, source_kind: "product", product_id: product.id, title: "Updated piece", sort_position: 5, is_active: "on" }));
    assert.equal(result.ok, true, result.message); expectInvalidation();
    const fresh = await row(productItem.id);
    assert.notEqual(fresh.updated_at, productItem.updated_at);
    const stale = await saveShowroomItem({}, form({ id: productItem.id, updated_at: productItem.updated_at, source_kind: "product", product_id: product.id, title: "Stale overwrite", sort_position: 5 }));
    assert.equal(stale.ok, false);
    assert.equal((await deleteShowroomItem({}, form({ id: productItem.id, updated_at: productItem.updated_at }))).ok, false);
    assert.equal((await row(productItem.id)).title, "Updated piece");
    assert.equal(globalThis.__showroomInvalidations.length, 0);
    productItem = fresh;
  });
  await check("A custom image is processed, overrides the catalog photo, and can be removed", async () => {
    const photo = await sharp({ create: { width: 120, height: 80, channels: 3, background: "#383e45" } }).png().toBuffer();
    const values = { id: productItem.id, updated_at: productItem.updated_at, source_kind: "product",
      product_id: product.id, sort_position: 5, title: productItem.title, is_active: "on" };
    const data = form(values);
    data.set("image", new File([photo], "synthetic.png", { type: "image/png" }));
    const result = await saveShowroomItem({}, data);
    assert.equal(result.ok, true, result.message);
    expectInvalidation();
    const current = await row(productItem.id);
    assert(uploaded.has(current.image_path));
    assert.equal((await loadHomepageShowroom()).find(card => card.id === current.id).image,
      `${supabaseUrl}/storage/v1/object/public/product-images/${current.image_path}`);
    assert.equal((await saveShowroomItem({}, form({ ...values, updated_at: current.updated_at, remove_image: "on" }))).ok, true);
    expectInvalidation();
    productItem = await row(current.id);
    assert.equal(productItem.image_path, null);
    assert.equal(uploaded.size, 0);
    assert.match((await loadHomepageShowroom()).find(card => card.id === current.id).image, /^\/images\//);
  });
  await check("Inactive source and hidden cards never leak through public loader", async () => {
    await db.query("update public.products set status='draft' where id=$1", [product.id]);
    const cards = await loadHomepageShowroom();
    assert(!cards.some(card => card.id === productItem.id));
    await db.query("update public.products set status='active' where id=$1", [product.id]);
    await db.query("update public.homepage_showroom_items set is_active=false where id=$1", [categoryItem.id]);
    assert(!(await loadHomepageShowroom()).some(card => card.id === categoryItem.id));
  });
  await check("Image mapper rejects outside sources and accepts only project catalog assets", async () => {
    const images = [
      { image_url: "https://foreign.example.invalid/private.jpg", storage_path: null, sort_position: 0 },
      { image_url: "/images/hoodie.jpg", storage_path: null, sort_position: 1 },
    ];
    assert.equal(showroomImage(images, supabaseUrl), "/images/hoodie.jpg");
    assert.equal(showroomImage(images.slice(0, 1), supabaseUrl), null);
    assert.equal(showroomImage([{ image_url: null, storage_path: "folder/photo name.webp", sort_position: 0 }], supabaseUrl), `${supabaseUrl}/storage/v1/object/public/product-images/folder/photo%20name.webp`);
  });
  await check("Source failures return no private content and only fixed diagnostic messages", async () => {
    forcedFailure = { table: "homepage_showroom_items", code: "XX000" };
    assert.deepEqual(await loadHomepageShowroom(), []);
    forcedFailure = { table: "homepage_showroom_settings", code: "XX000" };
    assert.equal(await loadHomepageShowroom(), undefined);
    forcedFailure = null;
    assert(errors.every(message => !message.includes("SYNTHETIC PRIVATE DATABASE ERROR")));
  });
  await check("Deleting through the real action invalidates the homepage without deleting source product", async () => {
    const fresh = await row(productItem.id);
    assert.equal((await deleteShowroomItem({}, form({ id: fresh.id, updated_at: fresh.updated_at }))).ok, true);
    expectInvalidation();
    assert.equal(await row(productItem.id), undefined);
    assert.equal((await db.query("select count(*)::int count from public.products where id=$1", [product.id])).rows[0].count, 1);
  });

  const report = {
    status: "PASSED", production_accessed: false,
    scope: "Actual TypeScript services and actions, real Supabase SSR/client SDKs and PGlite RLS. Local HTTP/Auth fixture; no hosted Auth, PostgREST or browser.",
    checks, requests: requests.length,
  };
  writeFileSync(resolve(repoDirectory, "qa/showroom-service-results.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalError;
  await db.close();
}
