import "server-only";
import { requirePage } from "../auth/guards";

const orderColumns =
  "id,order_number,customer_email,delivery_name,created_at,currency,final_total,payment_status,fulfillment_status,is_test" as const;

function tbilisiDayStartIso(now = new Date()) {
  const local = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, "0");
  const day = String(local.getUTCDate()).padStart(2, "0");
  return new Date(`${year}-${month}-${day}T00:00:00+04:00`).toISOString();
}

export async function adminDashboardMetrics() {
  const { client } = await requirePage(true);
  const dayStart = tbilisiDayStartIso();
  const results = await Promise.all([
    client.from("products").select("id", { count: "exact", head: true }),
    client
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    client
      .from("product_variants")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .gt("stock_quantity", 0)
      .lte("stock_quantity", 5),
    client
      .from("product_variants")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("stock_quantity", 0),
    client
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("is_test", false)
      .gte("created_at", dayStart),
    client
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("is_test", false)
      .eq("payment_status", "pending"),
    client
      .from("orders")
      .select("final_total")
      .eq("is_test", false)
      .eq("payment_status", "paid")
      .gte("paid_at", dayStart),
  ]);

  for (const result of results) {
    if (result.error) throw new Error("Admin data unavailable.");
  }

  return {
    total: results[0].count ?? 0,
    active: results[1].count ?? 0,
    low: results[2].count ?? 0,
    empty: results[3].count ?? 0,
    todayOrders: results[4].count ?? 0,
    pendingPayment: results[5].count ?? 0,
    todayRevenue: (results[6].data ?? []).reduce(
      (sum, order) => sum + order.final_total,
      0,
    ),
  };
}

export async function adminRecentOrders() {
  const { client } = await requirePage(true);
  const { data, error } = await client
    .from("orders")
    .select(orderColumns)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) throw new Error("Recent orders unavailable.");
  return data ?? [];
}

export async function adminBestSellers() {
  const { client } = await requirePage(true);
  const { data: paidOrders, error: paidError } = await client
    .from("orders")
    .select("id")
    .eq("is_test", false)
    .eq("payment_status", "paid")
    .order("paid_at", { ascending: false })
    .limit(1000);

  if (paidError) throw new Error("Sales analytics unavailable.");
  const paidOrderIds = (paidOrders ?? []).map((order) => order.id);
  if (!paidOrderIds.length) return [];

  const { data: items, error } = await client
    .from("order_items")
    .select("product_name,quantity,line_total")
    .in("order_id", paidOrderIds)
    .limit(5000);
  if (error) throw new Error("Sales analytics unavailable.");

  const bestSellers = new Map<
    string,
    { name: string; units: number; sales: number }
  >();
  for (const item of items ?? []) {
    const current = bestSellers.get(item.product_name) ?? {
      name: item.product_name,
      units: 0,
      sales: 0,
    };
    current.units += item.quantity;
    current.sales += item.line_total;
    bestSellers.set(item.product_name, current);
  }

  return [...bestSellers.values()]
    .sort((a, b) => b.units - a.units || b.sales - a.sales)
    .slice(0, 5);
}
