import "server-only";
import { requirePage } from "../auth/guards";
import { id } from "../validation";
const orderColumns = "id,order_number,customer_email,created_at,currency,final_total,payment_status,fulfillment_status" as const;
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
export async function adminOrders(page = 1) {
    const { client } = await requirePage(true);
    const { data, count, error } = await client.from("orders").select(orderColumns, { count: "exact" }).order("created_at", { ascending: false }).order("id").range((page - 1) * 25, page * 25 - 1);
    if (error)
        throw new Error("Orders unavailable.");
    return { orders: data ?? [], count: count ?? 0 };
}
export async function adminOrder(orderId: string) {
    const { client } = await requirePage(true);
    const { data, error } = await client.from("orders").select("*,order_items(*)").eq("id", id(orderId)).maybeSingle();
    if (error)
        throw new Error("Order unavailable.");
    return data;
}
