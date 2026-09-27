import "server-only";
import { requirePage } from "../auth/guards";
import { id } from "../validation";
const orderColumns = "id,order_number,customer_email,delivery_name,created_at,currency,final_total,payment_status,fulfillment_status" as const;

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
    return (value ?? "")
        .trim()
        .slice(0, 80)
        .replace(/[^a-zA-Z0-9@._+\- ]/g, "");
}

function isPaymentStatus(value: string | undefined): value is (typeof ADMIN_PAYMENT_STATUSES)[number] {
    return !!value && ADMIN_PAYMENT_STATUSES.includes(value as (typeof ADMIN_PAYMENT_STATUSES)[number]);
}

function isFulfillmentStatus(value: string | undefined): value is (typeof ADMIN_FULFILLMENT_STATUSES)[number] {
    return !!value && ADMIN_FULFILLMENT_STATUSES.includes(value as (typeof ADMIN_FULFILLMENT_STATUSES)[number]);
}
export async function adminOverview() {
    const { client } = await requirePage(true);
    const results = await Promise.all([
        client.from("products").select("id", { count: "exact", head: true }),
        client.from("products").select("id", { count: "exact", head: true }).eq("status", "active"),
        client.from("product_variants").select("id", { count: "exact", head: true }).eq("is_active", true).gt("stock_quantity", 0).lte("stock_quantity", 5),
        client.from("product_variants").select("id", { count: "exact", head: true }).eq("is_active", true).eq("stock_quantity", 0),
        client.from("orders").select(orderColumns).order("created_at", { ascending: false }).limit(5)
    ]);
    for (const result of results)
        if (result.error)
            throw new Error("Admin data unavailable.");
    return { total: results[0].count ?? 0, active: results[1].count ?? 0, low: results[2].count ?? 0, empty: results[3].count ?? 0, orders: results[4].data ?? [] };
}
export async function adminProducts(page = 1) {
    const { client } = await requirePage(true);
    const { data, count, error } = await client.from("products").select("id,name,slug,status,price,updated_at", { count: "exact" }).order("created_at", { ascending: false }).order("id").range((page - 1) * 25, page * 25 - 1);
    if (error)
        throw new Error("Products unavailable.");
    return { products: data ?? [], count: count ?? 0 };
}
export async function adminOptions() {
    const { client } = await requirePage(true);
    const categories = [];
    const collections = [];
    for (let offset = 0;; offset += 100) {
        const { data, error } = await client.from("categories").select("id,name,is_active").order("sort_position").order("id").range(offset, offset + 99);
        if (error)
            throw new Error("Categories unavailable.");
        categories.push(...data);
        if (data.length < 100)
            break;
    }
    for (let offset = 0;; offset += 100) {
        const { data, error } = await client.from("collections").select("id,name,is_active").order("name").order("id").range(offset, offset + 99);
        if (error)
            throw new Error("Collections unavailable.");
        collections.push(...data);
        if (data.length < 100)
            break;
    }
    return { categories, collections };
}
export async function adminProduct(productId: string) {
    const { client } = await requirePage(true);
    const { data, error } = await client.from("products").select("*,product_variants(*),product_images(*),product_collections(collection_id)").eq("id", id(productId)).maybeSingle();
    if (error)
        throw new Error("Product unavailable.");
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
        client.from("orders").select("id", { count: "exact", head: true }).eq("payment_status", "pending"),
        client.from("orders").select("id", { count: "exact", head: true }).eq("payment_status", "paid").eq("fulfillment_status", "unfulfilled"),
        client.from("orders").select("id", { count: "exact", head: true }).in("fulfillment_status", ["processing", "shipped"]),
    ]);
    for (const result of results)
        if (result.error)
            throw new Error("Order statistics unavailable.");
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
        query = query.or(`order_number.ilike.%${search}%,customer_email.ilike.%${search}%,delivery_name.ilike.%${search}%`);

    const { data, count, error } = await query.range((page - 1) * 25, page * 25 - 1);
    if (error)
        throw new Error("Orders unavailable.");
    return { orders: data ?? [], count: count ?? 0, page, search };
}
export async function adminOrder(orderId: string) {
    const { client } = await requirePage(true);
    const { data, error } = await client.from("orders").select("*,order_items(*)").eq("id", id(orderId)).maybeSingle();
    if (error)
        throw new Error("Order unavailable.");
    return data;
}
