import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createTestDatabase } from "./database-harness.mjs";
const db = await createTestDatabase({phase2Only:true});
const passed = [];
const alice = "10000000-0000-0000-0000-000000000001";
const bob = "10000000-0000-0000-0000-000000000002";
async function check(name, fn) {
  await fn();
  passed.push(name);
}
async function as(role, id, fn) {
  await db.exec("begin");
  try {
    await db.exec("set local role " + role);
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      id ?? "",
    ]);
    return await fn();
  } finally {
    await db.exec("rollback");
  }
}
async function denied(role, id, sql, params = []) {
  await as(role, id, async () => {
    await assert.rejects(
      () => db.query(sql, params),
      (e) => ["42501", "23514", "23505", "23503"].includes(e.code),
    );
  });
}
async function invalid(sql, params = [], code = "23514") {
  await db.exec("begin");
  try {
    await assert.rejects(
      () => db.query(sql, params),
      (e) => e.code === code,
    );
  } finally {
    await db.exec("rollback");
  }
}
try {
  await db.query(
    "insert into auth.users(id,raw_user_meta_data) values ($1,'{\"role\":\"admin\"}'),($2,'{}')",
    [alice, bob],
  );
  await check("Auth profile trigger ignores metadata role", async () =>
    assert.equal(
      (await db.query("select role from public.profiles where id=$1", [alice]))
        .rows[0].role,
      "customer",
    ),
  );
  await check("Seed is re-runnable without duplicates", async () => {
    await db.exec(await readFile("supabase/seed.sql", "utf8"));
    assert.equal(
      (await db.query("select count(*)::int n from products")).rows[0].n,
      4,
    );
  });
  const hoodie = (
    await db.query("select * from products where slug='distressed-hoodie'")
  ).rows[0];
  const tee = (await db.query("select * from products where slug='heavy-tee'"))
    .rows[0];
  const variant = (
    await db.query(
      "select * from product_variants where product_id=$1 order by sort_position",
      [hoodie.id],
    )
  ).rows[0];
  const hidden = (
    await db.query(
      "insert into products(name,slug,price,category_id) values ('Draft','draft-product',100,$1) returning id",
      [hoodie.category_id],
    )
  ).rows[0];
  await db.query(
    "insert into product_variants(product_id,sku,size,color,stock_quantity) values ($1,'DRAFT-01','M','Black',10),($2,'INACTIVE-01','XXL','Black',10)",
    [hidden.id, hoodie.id],
  );
  await db.exec(
    "update product_variants set is_active=false where sku='INACTIVE-01'",
  );
  await db.query(
    "insert into product_images(product_id,image_url) values ($1,'/images/hoodie.jpg')",
    [hidden.id],
  );
  const hiddenCollection = (
    await db.query(
      "insert into collections(name,slug) values ('Hidden','hidden') returning id",
    )
  ).rows[0];
  await db.query(
    "insert into product_collections(product_id,collection_id) values ($1,$2)",
    [hoodie.id, hiddenCollection.id],
  );
  await db.query(
    "insert into addresses(profile_id,recipient_name,phone,city,address_line_1) values ($1,'Alice','123','Tbilisi','A'),($2,'Bob','456','Tbilisi','B')",
    [alice, bob],
  );
  const orderSql =
    "insert into orders(customer_id,subtotal,final_total,customer_email,delivery_name,delivery_phone,delivery_country_code,delivery_city,delivery_address_line_1) values ($1,24900,24900,'test@example.com','Snapshot name','123','GE','Tbilisi','Snapshot street') returning id";
  const order = (await db.query(orderSql, [alice])).rows[0];
  const bobOrder = (await db.query(orderSql, [bob])).rows[0];
  const itemSql =
    "insert into order_items(order_id,product_id,variant_id,product_name,product_slug,sku,size,color,unit_price,quantity,line_total) values ($1,$2,$3,'Original hoodie','original-hoodie','ORIGINAL-SKU','S','Black',24900,1,24900)";
  await db.query(itemSql, [order.id, hoodie.id, variant.id]);
  await db.query(itemSql, [bobOrder.id, hoodie.id, variant.id]);
  await db.exec(
    "insert into promo_codes(code,kind,amount,currency) values ('SECRET10','fixed',1000,'GEL')",
  );
  await check("All 11 tables have RLS enabled", async () => {
    const r = await db.query(
      "select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'",
    );
    assert.equal(r.rows.length, 11);
    assert.ok(r.rows.every((r) => r.relrowsecurity));
  });
  for (const role of ["anon", "authenticated"]) {
    const uid = role === "authenticated" ? alice : null;
    await check(role + ": active public catalog only", () =>
      as(role, uid, async () => {
        assert.equal(
          (await db.query("select count(*)::int n from products")).rows[0].n,
          4,
        );
        assert.equal(
          (await db.query("select count(*)::int n from product_variants"))
            .rows[0].n,
          13,
        );
        assert.equal(
          (await db.query("select count(*)::int n from product_images")).rows[0]
            .n,
          4,
        );
        assert.equal(
          (await db.query("select count(*)::int n from collections")).rows[0].n,
          1,
        );
        assert.equal(
          (await db.query("select count(*)::int n from product_collections"))
            .rows[0].n,
          2,
        );
      }),
    );
    for (const [name, sql] of [
      ["price write", "update products set price=1"],
      ["stock write", "update product_variants set stock_quantity=999"],
      [
        "catalog insert",
        "insert into categories(name,slug) values ('Injected','injected')",
      ],
      ["catalog delete", "delete from products"],
      ["order totals", "update orders set final_total=0"],
      ["payment status", "update orders set payment_status='paid'"],
      ["order deletion", "delete from orders"],
      ["order items write", "update order_items set unit_price=0"],
      ["promo enumeration", "select * from promo_codes"],
      ["promo write", "update promo_codes set amount=1"],
    ])
      await check(role + ": denies " + name, () => denied(role, uid, sql));
  }
  await check(
    "Inactive categories hide parent products and children",
    async () => {
      await db.query("update categories set is_active=false where id=$1", [
        hoodie.category_id,
      ]);
      await as("anon", null, async () => {
        assert.equal(
          (
            await db.query("select count(*)::int n from products where id=$1", [
              hoodie.id,
            ])
          ).rows[0].n,
          0,
        );
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from product_images where product_id=$1",
              [hoodie.id],
            )
          ).rows[0].n,
          0,
        );
      });
      await db.query("update categories set is_active=true where id=$1", [
        hoodie.category_id,
      ]);
    },
  );
  for (const table of ["profiles", "addresses", "orders", "order_items"])
    await check("anon: denies private " + table, () =>
      denied("anon", null, "select * from " + table),
    );
  for (const uid of [alice, bob])
    await check(uid + ": sees only own private rows", () =>
      as("authenticated", uid, async () => {
        assert.deepEqual(
          (await db.query("select id from profiles")).rows.map((r) => r.id),
          [uid],
        );
        assert.equal(
          (await db.query("select count(*)::int n from addresses")).rows[0].n,
          1,
        );
        assert.equal(
          (await db.query("select count(*)::int n from orders")).rows[0].n,
          1,
        );
        assert.equal(
          (await db.query("select count(*)::int n from order_items")).rows[0].n,
          1,
        );
      }),
    );
  await check("Customer can update allowed own profile fields", () =>
    as("authenticated", alice, async () => {
      await db.query(
        "update profiles set full_name='Alice',phone='123' where id=$1",
        [alice],
      );
      assert.equal(
        (await db.query("select full_name from profiles")).rows[0].full_name,
        "Alice",
      );
    }),
  );
  await check("Other profile update affects no rows", () =>
    as("authenticated", alice, async () =>
      assert.equal(
        (
          await db.query(
            "update profiles set full_name='hacked' where id=$1 returning id",
            [bob],
          )
        ).rows.length,
        0,
      ),
    ),
  );
  await check("Cannot grant self admin", () =>
    denied(
      "authenticated",
      alice,
      "update profiles set role='admin' where id=$1",
      [alice],
    ),
  );
  await check("Cannot forge a profile", () =>
    denied(
      "authenticated",
      alice,
      "insert into profiles(id,role) values ($1,'admin')",
      [bob],
    ),
  );
  await check("Cannot change owner or timestamps", () =>
    denied(
      "authenticated",
      alice,
      "update profiles set id=$1,created_at=now()",
      [bob],
    ),
  );
  await check("Customer can create/update/delete own address", () =>
    as("authenticated", alice, async () => {
      const a = (
        await db.query(
          "insert into addresses(recipient_name,phone,city,address_line_1) values ('Me','123','Tbilisi','Street') returning id",
        )
      ).rows[0];
      await db.query("update addresses set city='Batumi' where id=$1", [a.id]);
      assert.equal(
        (
          await db.query("delete from addresses where id=$1 returning id", [
            a.id,
          ])
        ).rows.length,
        1,
      );
    }),
  );
  await check("Cannot insert address for another customer", () =>
    denied(
      "authenticated",
      alice,
      "insert into addresses(profile_id,recipient_name,phone,city,address_line_1) values ($1,'Me','123','X','Y')",
      [bob],
    ),
  );
  await check("Cannot transfer address ownership", () =>
    denied("authenticated", alice, "update addresses set profile_id=$1", [bob]),
  );
  await check("Cannot delete others' address", () =>
    as("authenticated", alice, async () =>
      assert.equal(
        (
          await db.query(
            "delete from addresses where profile_id=$1 returning id",
            [bob],
          )
        ).rows.length,
        0,
      ),
    ),
  );
  await check("Cannot create arbitrary order", () =>
    denied("authenticated", alice, orderSql, [alice]),
  );
  await check("Null auth identity sees no private rows", () =>
    as("authenticated", null, async () =>
      assert.equal(
        (await db.query("select count(*)::int n from orders")).rows[0].n,
        0,
      ),
    ),
  );
  await db.query("update profiles set role='admin' where id=$1", [alice]);
  await check("Admin role alone has no commercial API write powers", () =>
    denied("authenticated", alice, "update products set price=0"),
  );
  await check("Negative price fails", () =>
    invalid("update products set price=-1"),
  );
  await check("Negative stock fails", () =>
    invalid("update product_variants set stock_quantity=-1"),
  );
  await check("Compare price below price fails", () =>
    invalid("update products set compare_at_price=1"),
  );
  await check("Duplicate slug fails", () =>
    invalid(
      "update products set slug='distressed-hoodie' where id=$1",
      [tee.id],
      "23505",
    ),
  );
  await check("Duplicate SKU fails", () =>
    invalid(
      "update product_variants set sku=$1 where sku='KUL-TS-BLK-S'",
      [variant.sku],
      "23505",
    ),
  );
  await check("Case-insensitive duplicate options fail", () =>
    invalid(
      "insert into product_variants(product_id,sku,size,color) values ($1,'DUP','s','black')",
      [hoodie.id],
      "23505",
    ),
  );
  await check("Invalid category fails", () =>
    invalid(
      "update products set category_id='99999999-0000-0000-0000-000000000000'",
      [],
      "23503",
    ),
  );
  await check("Image source exclusivity enforced", () =>
    invalid("update product_images set storage_path='x.jpg'"),
  );
  await check("Unsafe image URL rejected", () =>
    invalid("update product_images set image_url='javascript:alert(1)'"),
  );
  await check("Invalid total rejected", () =>
    invalid("update orders set final_total=1"),
  );
  await check("Zero quantity rejected", () =>
    invalid("update order_items set quantity=0"),
  );
  await check("Variant belongs to item product", () =>
    invalid(itemSql, [order.id, tee.id, variant.id], "23503"),
  );
  await check("Invalid percentage rejected", () =>
    invalid(
      "insert into promo_codes(code,kind,amount) values ('TOOMUCH','percentage',10001)",
    ),
  );
  await check("Expired-before-start promo rejected", () =>
    invalid(
      "insert into promo_codes(code,kind,amount,starts_at,expires_at) values ('BADDATES','percentage',100,'2026-02-01','2026-01-01')",
    ),
  );
  await check("Cannot delete purchased product", () =>
    invalid("delete from products where id=$1", [hoodie.id], "23001"),
  );
  await check("Cannot delete purchased variant", () =>
    invalid("delete from product_variants where id=$1", [variant.id], "23001"),
  );
  await check("Product edits do not alter snapshots", async () => {
    await db.query("update products set name='Changed',price=1 where id=$1", [
      hoodie.id,
    ]);
    assert.deepEqual(
      (
        await db.query(
          "select product_name,unit_price from order_items where order_id=$1",
          [order.id],
        )
      ).rows[0],
      { product_name: "Original hoodie", unit_price: 24900 },
    );
  });
  await check(
    "Deleting customer keeps orders and delivery snapshot",
    async () => {
      await db.query("delete from auth.users where id=$1", [alice]);
      const o = (
        await db.query(
          "select customer_id,delivery_name from orders where id=$1",
          [order.id],
        )
      ).rows[0];
      assert.equal(o.customer_id, null);
      assert.equal(o.delivery_name, "Snapshot name");
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from addresses where profile_id=$1",
            [alice],
          )
        ).rows[0].n,
        0,
      );
    },
  );
  await check("Service role can manage catalog", () =>
    as("service_role", null, async () => {
      await db.query("update products set price=300 where id=$1", [hoodie.id]);
      assert.equal(
        (await db.query("select price from products where id=$1", [hoodie.id]))
          .rows[0].price,
        300,
      );
    }),
  );
  const report = {
    engine: "PGlite PostgreSQL; minimal Supabase auth shim",
    checks: passed.length,
    passed,
  };
  await writeFile("qa/database-results.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await db.close();
}
