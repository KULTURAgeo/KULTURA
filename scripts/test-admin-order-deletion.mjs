
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createTestDatabase } from "./database-harness.mjs";

const db = await createTestDatabase({ seed: false });
const adminId = randomUUID();
const customerId = randomUUID();
const suffix = randomUUID().slice(0, 8);
const checks = [];

async function check(name, fn) {
  await fn();
  checks.push(name);
}

async function asUser(userId, query, params = []) {
  await db.exec("begin; set local role authenticated;");
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    const result = await db.query(query, params);
    await db.exec("commit;");
    return result;
  } catch (error) {
    await db.exec("rollback;");
    throw error;
  }
}

async function makeOrder(number, status = "pending") {
  const order = await db.query(
    `insert into public.orders(order_number, payment_status, fulfillment_status,
       subtotal, shipping_total, discount_total, final_total, customer_email,
       delivery_name, delivery_phone, delivery_country_code, delivery_city,
       delivery_address_line_1, is_test)
     values ($1, $2, $3, 4900, 0, 0, 4900, 'order-delete@example.invalid',
       'Synthetic Customer', '+995555000000', 'GE', 'Tbilisi', 'Test Street', false)
     returning id, updated_at`,
    [number, status === "paid" ? "paid" : "pending", status === "paid" ? "delivered" : "unfulfilled"],
  );
  return order.rows[0];
}

try {
  await db.query("insert into auth.users(id, email) values ($1, $2), ($3, $4)", [
    adminId,
    `order-delete-admin-${suffix}@example.invalid`,
    customerId,
    `order-delete-customer-${suffix}@example.invalid`,
  ]);
  await db.query("update public.profiles set role = 'admin' where id = $1", [adminId]);

  const orderNumber = `DEL-${suffix.toUpperCase()}`;
  const order = await makeOrder(orderNumber, "paid");
  await db.query(
    `insert into public.order_items(order_id, product_name, product_slug, sku, size, color,
       unit_price, quantity, line_total)
     values ($1, 'Synthetic Order Item', 'synthetic-order-item', 'SYN-ORDER', 'M', 'Black', 4900, 1, 4900)`,
    [order.id],
  );

  await check("Only admins can execute the order delete RPC", async () => {
    await assert.rejects(
      asUser(customerId, "select public.admin_delete_order($1, $2, $3)", [order.id, order.updated_at, orderNumber]),
      (error) => error.code === "42501",
    );
    assert.equal((await db.query("select count(*)::int as count from public.orders where id=$1", [order.id])).rows[0].count, 1);
  });

  await check("Exact order-number confirmation and current version are required", async () => {
    await assert.rejects(
      asUser(adminId, "select public.admin_delete_order($1, $2, $3)", [order.id, order.updated_at, "WRONG"]),
      (error) => error.code === "22023",
    );
    await assert.rejects(
      asUser(adminId, "select public.admin_delete_order($1, $2, $3)", [order.id, new Date(0).toISOString(), orderNumber]),
      (error) => error.code === "40001",
    );
    assert.equal((await db.query("select count(*)::int as count from public.orders where id=$1", [order.id])).rows[0].count, 1);
  });

  const heldNumber = `HELD-${suffix.toUpperCase()}`;
  const heldOrder = await makeOrder(heldNumber);
  const heldCategory = await db.query(
    "insert into public.categories(name,slug) values ('Reserved order category',$1) returning id",
    [`held-category-${suffix}`],
  );
  const heldProduct = await db.query(
    "insert into public.products(name,slug,price,category_id) values ('Reserved order product',$1,4900,$2) returning id",
    [`held-product-${suffix}`, heldCategory.rows[0].id],
  );
  const heldVariant = await db.query(
    "insert into public.product_variants(product_id,sku,size,color,stock_quantity) values ($1,$2,'M','Black',1) returning id",
    [heldProduct.rows[0].id, `HLD-${suffix.toUpperCase()}`],
  );
  await db.query("insert into private.checkout_reservations(order_id) values ($1)", [heldOrder.id]);
  await db.query(
    "insert into private.checkout_reserved_items(order_id,product_id,variant_id,quantity) values ($1,$2,$3,1)",
    [heldOrder.id, heldProduct.rows[0].id, heldVariant.rows[0].id],
  );

  await check("Held inventory reservations block deletion without touching the order", async () => {
    await assert.rejects(
      asUser(adminId, "select public.admin_delete_order($1, $2, $3)", [heldOrder.id, heldOrder.updated_at, heldNumber]),
      (error) => error.code === "23503",
    );
    assert.equal((await db.query("select count(*)::int as count from public.orders where id=$1", [heldOrder.id])).rows[0].count, 1);
  });

  await check("Admin deletion removes the exact order and its item snapshots", async () => {
    await asUser(adminId, "select public.admin_delete_order($1, $2, $3)", [order.id, order.updated_at, orderNumber]);
    assert.equal((await db.query("select count(*)::int as count from public.orders where id=$1", [order.id])).rows[0].count, 0);
    assert.equal((await db.query("select count(*)::int as count from public.order_items where order_id=$1", [order.id])).rows[0].count, 0);
    assert.equal((await db.query("select count(*)::int as count from public.orders where order_number=$1", [heldNumber])).rows[0].count, 1);
  });

  await check("A resolved reservation can be cleaned up with its deleted order", async () => {
    await db.query("update private.checkout_reservations set state='released',resolved_at=clock_timestamp() where order_id=$1", [heldOrder.id]);
    await asUser(adminId, "select public.admin_delete_order($1, $2, $3)", [heldOrder.id, heldOrder.updated_at, heldNumber]);
    assert.equal((await db.query("select count(*)::int as count from private.checkout_reservations where order_id=$1", [heldOrder.id])).rows[0].count, 0);
    assert.equal((await db.query("select count(*)::int as count from private.checkout_reserved_items where order_id=$1", [heldOrder.id])).rows[0].count, 0);
    assert.equal((await db.query("select count(*)::int as count from public.orders where id=$1", [heldOrder.id])).rows[0].count, 0);
  });

  console.log(JSON.stringify({
    status: "PASSED",
    scope: "Disposable local PGlite database; synthetic order fixtures only",
    production_accessed: false,
    checks,
  }, null, 2));
} finally {
  await db.close();
}

