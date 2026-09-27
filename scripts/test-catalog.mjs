import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { createTestDatabase } from "./database-harness.mjs";
import { getCatalog, getProductBySlug } from "../src/lib/catalog/repository.ts";
import { mapProduct } from "../src/lib/catalog/mapper.ts";
import { money } from "../src/lib/catalog.ts";
const db = await createTestDatabase();
const originalFetch = globalThis.fetch;
const originalUrl = process.env.SUPABASE_URL;
const originalKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const checks = [];
let mode = "ready";
const requests = [];
const publicSql = `
select p.id,p.slug,p.name,p.price,p.compare_at_price,p.description,p.featured,p.is_drop,p.seo_title,p.seo_description,
jsonb_build_object('name',c.name,'slug',c.slug) as category,
coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'sku',v.sku,'size',v.size,'color',v.color,'stock_quantity',v.stock_quantity,'is_active',v.is_active,'sort_position',v.sort_position)) from product_variants v where v.product_id=p.id),'[]') as variants,
coalesce((select jsonb_agg(jsonb_build_object('image_url',i.image_url,'storage_path',i.storage_path,'alt_text',i.alt_text,'sort_position',i.sort_position)) from product_images i where i.product_id=p.id),'[]') as images
from products p join categories c on c.id=p.category_id
where p.status='active' and ($1::text is null or p.slug=$1) order by p.created_at desc,p.id limit $2 offset $3
`;
try {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  assert.equal((await getCatalog()).status, "unconfigured");
  checks.push("Unconfigured catalog is empty; no mock fallback");
  process.env.SUPABASE_URL = "https://kultura-test.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_TEST_ONLY_NOT_A_REAL_KEY";
  // Test-only transport double. SQL runs as anon with real RLS; this is not hosted PostgREST.
  globalThis.fetch = async (input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    assert.equal(url.origin, "https://kultura-test.supabase.co");
    assert.equal(init?.cache, "no-store");
    requests.push(url.pathname);
    if (mode === "error")
      return new Response(
        JSON.stringify({ message: "test outage", code: "TEST" }),
        { status: 503, headers: { "content-type": "application/json" } },
      );
    if (mode === "empty")
      return new Response("[]", {
        headers: { "content-type": "application/json" },
      });
    await db.exec("begin;set local role anon");
    try {
      let rows;
      if (url.pathname.endsWith("/products")) {
        assert.equal(url.searchParams.get("status"), "eq.active");
        const slug = url.searchParams.get("slug")?.replace(/^eq\./, "") ?? null;
        rows = (
          await db.query(publicSql, [
            slug,
            Number(url.searchParams.get("limit") ?? 100),
            Number(url.searchParams.get("offset") ?? 0),
          ])
        ).rows;
      } else {
        assert.ok(url.pathname.endsWith("/categories"));
        rows = (
          await db.query(
            "select name,slug from categories where is_active order by sort_position,id limit $1 offset $2",
            [
              Number(url.searchParams.get("limit") ?? 100),
              Number(url.searchParams.get("offset") ?? 0),
            ],
          )
        ).rows;
      }
      return new Response(JSON.stringify(rows), {
        headers: { "content-type": "application/json" },
      });
    } finally {
      await db.exec("rollback");
    }
  };
  const catalog = await getCatalog();
  assert.equal(catalog.status, "ready");
  assert.equal(catalog.products.length, 4);
  assert.equal(catalog.categories.length, 4);
  assert.deepEqual(
    catalog.products.map((p) => p.slug),
    ["distressed-hoodie", "heavy-tee", "wide-leg-pants", "star-cap"],
  );
  checks.push(
    "Supabase SDK listing maps all four seeded products and categories",
  );
  const detail = await getProductBySlug("distressed-hoodie");
  assert.equal(detail.status, "ready");
  assert.equal(detail.product?.price, 24900);
  assert.equal(detail.product?.variants.length, 4);
  assert.equal(detail.product?.variants[1].stock, 8);
  assert.equal(detail.product?.images[0].src, "/images/hoodie.jpg");
  checks.push("Product detail maps price, variants, image and stock");
  assert.equal((await getProductBySlug("not-a-product")).product, null);
  checks.push("Missing product returns null");
  await db.exec(
    "insert into products(name,slug,price,category_id) select 'Draft','draft-test',1,id from categories limit 1",
  );
  assert.equal((await getProductBySlug("draft-test")).product, null);
  checks.push("Draft product is invisible through anon RLS");
  await db.exec(
    "insert into products(name,slug,price,status,category_id) select 'Extra '||i,'extra-'||i,100,'active',c.id from generate_series(1,101) i cross join (select id from categories limit 1) c",
  );
  assert.equal((await getCatalog()).products.length, 105);
  checks.push(
    "Listing retrieves multiple PostgREST pages without 100-row truncation",
  );
  const raw = (await db.query(publicSql, ["heavy-tee", 100, 0])).rows[0];
  raw.images = [
    {
      image_url: null,
      storage_path: "shirts/black tee.jpg",
      alt_text: "Back",
      sort_position: 1,
    },
    {
      image_url: "/images/tee.jpg",
      storage_path: null,
      alt_text: "Front",
      sort_position: 0,
    },
  ];
  const mapped = mapProduct(raw, process.env.SUPABASE_URL);
  assert.equal(mapped.images[0].alt, "Front");
  assert.ok(mapped.images[1].src.endsWith("shirts/black%20tee.jpg"));
  checks.push("Image ordering, alt text and storage-path encoding");
  raw.images = [
    {
      image_url: "https://untrusted.example/image.jpg",
      storage_path: null,
      alt_text: null,
      sort_position: 0,
    },
  ];
  assert.equal(
    mapProduct(raw, process.env.SUPABASE_URL).image,
    "/images/product-placeholder.svg",
  );
  checks.push("Unapproved external images use local placeholder");
  assert.match(money(12345), /123.45/);
  checks.push("GEL formatting preserves tetri");
  mode = "empty";
  assert.equal((await getCatalog()).products.length, 0);
  assert.equal((await getCatalog()).status, "ready");
  assert.equal((await getProductBySlug("distressed-hoodie")).product, null);
  checks.push("Empty database handled distinctly from failure");
  mode = "error";
  assert.equal((await getCatalog()).status, "unavailable");
  assert.equal(
    (await getProductBySlug("distressed-hoodie")).status,
    "unavailable",
  );
  checks.push("Transport failure becomes safe unavailable state");
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_secret_TEST_ONLY_NOT_A_REAL_KEY";
  const before = requests.length;
  assert.equal((await getCatalog()).status, "unavailable");
  assert.equal(requests.length, before);
  checks.push("Privileged secret key rejected before any network request");
  process.env.SUPABASE_PUBLISHABLE_KEY =
    "eyJhbGciOiJIUzI1NiJ9." +
    Buffer.from(JSON.stringify({ role: "service_role" })).toString(
      "base64url",
    ) +
    ".invalid";
  assert.equal((await getCatalog()).status, "unavailable");
  assert.equal(requests.length, before);
  checks.push("Legacy service-role JWT also rejected");
  const report = {
    scope:
      "Real Supabase JS client with test-only HTTP responses from RLS-protected PGlite SQL; not hosted PostgREST",
    checks: checks.length,
    passed: checks,
  };
  await writeFile("qa/catalog-results.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
  else process.env.SUPABASE_PUBLISHABLE_KEY = originalKey;
  await db.close();
}
