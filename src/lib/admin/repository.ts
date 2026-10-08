import "server-only";
import { requirePage } from "../auth/guards";
import { id } from "../validation";

const orderColumns =
  "id,order_number,customer_email,delivery_name,created_at,currency,final_total,payment_status,fulfillment_status,is_test" as const;

export const ADMIN_PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
  "cancelled",
  "partially_refunded",
  "refunded",
] as const;

export const ADMIN_FULFILLMENT_STATUSES = [
  "unfulfilled",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
] as const;

export type AdminOrderFilters = {
  page?: number;
  search?: string;
  payment?: string;
  fulfillment?: string;
};

function safeSearch(value: string | undefined) {
  return (typeof value === "string" ? value : "")
    .trim()
    .slice(0, 80)
    .replace(/[^a-zA-Z0-9@.+\- ]/g, "");
}

function isPaymentStatus(
  value: string | undefined,
): value is (typeof ADMIN_PAYMENT_STATUSES)[number] {
  return (
    !!value &&
    ADMIN_PAYMENT_STATUSES.includes(
      value as (typeof ADMIN_PAYMENT_STATUSES)[number],
    )
  );
}

function isFulfillmentStatus(
  value: string | undefined,
): value is (typeof ADMIN_FULFILLMENT_STATUSES)[number] {
  return (
    !!value &&
    ADMIN_FULFILLMENT_STATUSES.includes(
      value as (typeof ADMIN_FULFILLMENT_STATUSES)[number],
    )
  );
}

export async function adminProducts(page = 1) {
  const { client } = await requirePage(true);
  const safePage = Math.floor(Math.max(1, Math.min(10000, page)));
  const offset = (safePage - 1) * 25;
  const { data, error } = await client
    .from("products")
    .select("id,name,slug,status,price,updated_at")
    .order("created_at", { ascending: false })
    .order("id")
    .range(offset, offset + 25);
  if (error) throw new Error("Products unavailable.");
  const rows = data ?? [];
  return {
    products: rows.slice(0, 25),
    hasNext: rows.length > 25,
    page: safePage,
  };
}

export async function adminOptions() {
  const { client } = await requirePage(true);

  const loadCategories = async () => {
    const rows = [];
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await client
        .from("categories")
        .select("id,name,is_active")
        .order("sort_position")
        .order("id")
        .range(offset, offset + 99);
      if (error) throw new Error("Categories unavailable.");
      rows.push(...data);
      if (data.length < 100) break;
    }
    return rows;
  };

  const loadCollections = async () => {
    const rows = [];
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await client
        .from("collections")
        .select("id,name,is_active")
        .order("name")
        .order("id")
        .range(offset, offset + 99);
      if (error) throw new Error("Collections unavailable.");
      rows.push(...data);
      if (data.length < 100) break;
    }
    return rows;
  };

  const [categories, collections] = await Promise.all([
    loadCategories(),
    loadCollections(),
  ]);
  return { categories, collections };
}

export async function adminProduct(productId: string) {
  const { client } = await requirePage(true);
  const { data, error } = await client
    .from("products")
    .select(
      "id,category_id,slug,name,description,price,compare_at_price,status,featured,is_drop,seo_title,seo_description,created_at,updated_at,product_variants(id,sku,size,color,stock_quantity,is_active,sort_position,updated_at),product_images(id,image_url,storage_path,alt_text,sort_position,updated_at),product_collections(collection_id)",
    )
    .eq("id", id(productId))
    .maybeSingle();
  if (error) throw new Error("Product unavailable.");
  if (data) {
    data.product_variants.sort((a, b) => a.sort_position - b.sort_position);
    data.product_images.sort((a, b) => a.sort_position - b.sort_position);
  }
  return data;
}

export async function adminOrderStats() {
  const { client } = await requirePage(true);
  const results = await Promise.all([
    client.from("orders").select("id", { count: "exact", head: true }),
    client
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("payment_status", "pending"),
    client
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("payment_status", "paid")
      .eq("fulfillment_status", "unfulfilled"),
    client
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("fulfillment_status", ["processing", "shipped"]),
  ]);
  for (const result of results)
    if (result.error) throw new Error("Order statistics unavailable.");
  return {
    total: results[0].count ?? 0,
    pendingPayment: results[1].count ?? 0,
    readyToFulfill: results[2].count ?? 0,
    inProgress: results[3].count ?? 0,
  };
}

export async function adminOrders(filters: AdminOrderFilters = {}) {
  const { client } = await requirePage(true);
  const page = Math.floor(Math.max(1, Math.min(10000, filters.page ?? 1)));
  const search = safeSearch(filters.search);
  let query = client
    .from("orders")
    .select(orderColumns, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id");

  if (isPaymentStatus(filters.payment))
    query = query.eq("payment_status", filters.payment);
  if (isFulfillmentStatus(filters.fulfillment))
    query = query.eq("fulfillment_status", filters.fulfillment);
  if (search)
    query = query.or(
      `order_number.ilike.%${search}%,customer_email.ilike.%${search}%,delivery_name.ilike.%${search}%`,
    );

  const { data, count, error } = await query.range(
    (page - 1) * 25,
    page * 25 - 1,
  );
  if (error) throw new Error("Orders unavailable.");
  return { orders: data ?? [], count: count ?? 0, page, search };
}

export async function adminOrder(orderId: string) {
  const { client } = await requirePage(true);
  const { data, error } = await client
    .from("orders")
    .select(
      "id,order_number,customer_id,customer_email,currency,subtotal,shipping_total,discount_total,final_total,payment_status,fulfillment_status,delivery_name,delivery_phone,delivery_country_code,delivery_city,delivery_address_line_1,delivery_address_line_2,delivery_postal_code,promo_code_snapshot,created_at,updated_at,paid_at,is_test,order_items(id,product_name,sku,size,color,unit_price,quantity,line_total)",
    )
    .eq("id", id(orderId))
    .maybeSingle();
  if (error) throw new Error("Order unavailable.");
  return data;
}

export async function adminPromos(page = 1) {
  const { client } = await requirePage(true);
  const safePage = Math.floor(Math.max(1, Math.min(10000, page)));
  const offset = (safePage - 1) * 25;
  const { data, error } = await client
    .from("promo_codes")
    .select(
      "id,code,kind,amount,currency,minimum_subtotal,maximum_discount,starts_at,expires_at,max_uses,used_count,is_active,updated_at",
    )
    .order("created_at", { ascending: false })
    .order("id")
    .range(offset, offset + 25);
  if (error) throw new Error("Promo codes unavailable.");
  const rows = data ?? [];
  return {
    promos: rows.slice(0, 25),
    hasNext: rows.length > 25,
    page: safePage,
  };
}

export async function adminPromo(promoId: string) {
  const { client } = await requirePage(true);
  const { data, error } = await client
    .from("promo_codes")
    .select(
      "id,code,kind,amount,currency,minimum_subtotal,maximum_discount,starts_at,expires_at,max_uses,used_count,is_active,created_at,updated_at",
    )
    .eq("id", id(promoId, "promo"))
    .maybeSingle();
  if (error) throw new Error("Promo code unavailable.");
  return data;
}
