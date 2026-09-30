import "server-only";
import { requirePage } from "@/lib/auth/guards";

export const INVENTORY_FILTERS = ["all", "low", "out", "in-stock", "inactive"] as const;
export type InventoryFilter = (typeof INVENTORY_FILTERS)[number];

export function inventoryFilter(value: string | undefined): InventoryFilter {
  return INVENTORY_FILTERS.includes(value as InventoryFilter)
    ? (value as InventoryFilter)
    : "all";
}

export async function adminInventoryStats() {
  const { client } = await requirePage(true);
  const results = await Promise.all([
    client.from("product_variants").select("id", { count: "exact", head: true }),
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
      .from("product_variants")
      .select("id", { count: "exact", head: true })
      .eq("is_active", false),
  ]);

  for (const result of results) {
    if (result.error) throw new Error("Inventory statistics unavailable.");
  }

  return {
    total: results[0].count ?? 0,
    low: results[1].count ?? 0,
    out: results[2].count ?? 0,
    inactive: results[3].count ?? 0,
  };
}

export async function adminInventory(filter: InventoryFilter, page = 1) {
  const { client } = await requirePage(true);
  const safePage = Math.floor(Math.max(1, Math.min(10000, page)));

  let query = client
    .from("product_variants")
    .select(
      "id,product_id,sku,size,color,stock_quantity,is_active,updated_at,products!inner(id,name,slug,status)",
      { count: "exact" },
    )
    .order("stock_quantity", { ascending: true })
    .order("sku", { ascending: true });

  if (filter === "low") {
    query = query.eq("is_active", true).gt("stock_quantity", 0).lte("stock_quantity", 5);
  } else if (filter === "out") {
    query = query.eq("is_active", true).eq("stock_quantity", 0);
  } else if (filter === "in-stock") {
    query = query.eq("is_active", true).gt("stock_quantity", 5);
  } else if (filter === "inactive") {
    query = query.eq("is_active", false);
  }

  const { data, count, error } = await query.range(
    (safePage - 1) * 50,
    safePage * 50 - 1,
  );

  if (error) throw new Error("Inventory unavailable.");

  return {
    variants: data ?? [],
    count: count ?? 0,
    page: safePage,
  };
}
