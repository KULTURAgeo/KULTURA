import "server-only";
import { requirePage } from "../auth/guards";
import { id } from "../validation";

export const ADMIN_RETURN_STATUSES = [
  "requested",
  "under_review",
  "approved",
  "rejected",
  "resolved",
] as const;

export const ADMIN_RETURN_TYPES = ["return", "refund"] as const;

export type AdminReturnFilters = {
  page?: number;
  status?: string;
  type?: string;
};

function isReturnStatus(value: string | undefined): value is (typeof ADMIN_RETURN_STATUSES)[number] {
  return !!value && ADMIN_RETURN_STATUSES.includes(value as (typeof ADMIN_RETURN_STATUSES)[number]);
}

function isReturnType(value: string | undefined): value is (typeof ADMIN_RETURN_TYPES)[number] {
  return !!value && ADMIN_RETURN_TYPES.includes(value as (typeof ADMIN_RETURN_TYPES)[number]);
}

export async function adminReturnStats() {
  const { client } = await requirePage(true);
  const results = await Promise.all([
    client.from("return_requests").select("id", { count: "exact", head: true }),
    client.from("return_requests").select("id", { count: "exact", head: true }).eq("status", "requested"),
    client.from("return_requests").select("id", { count: "exact", head: true }).eq("status", "under_review"),
    client.from("return_requests").select("id", { count: "exact", head: true }).eq("status", "approved"),
  ]);

  for (const result of results)
    if (result.error) throw new Error("Return request statistics unavailable.");

  return {
    total: results[0].count ?? 0,
    requested: results[1].count ?? 0,
    underReview: results[2].count ?? 0,
    approved: results[3].count ?? 0,
  };
}

export async function adminReturnRequests(filters: AdminReturnFilters = {}) {
  const { client } = await requirePage(true);
  const page = Math.floor(Math.max(1, Math.min(10000, filters.page ?? 1)));

  let query = client
    .from("return_requests")
    .select("id,order_id,request_type,reason,status,created_at,updated_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id");

  if (isReturnStatus(filters.status)) query = query.eq("status", filters.status);
  if (isReturnType(filters.type)) query = query.eq("request_type", filters.type);

  const { data, count, error } = await query.range((page - 1) * 25, page * 25 - 1);
  if (error) throw new Error("Return requests unavailable.");

  const requests = data ?? [];
  const orderIds = [...new Set(requests.map((request) => request.order_id))];
  const orderMap = new Map<string, {
    id: string;
    order_number: string;
    customer_email: string;
    delivery_name: string;
    currency: string;
    final_total: number;
  }>();

  if (orderIds.length) {
    const { data: orders, error: orderError } = await client
      .from("orders")
      .select("id,order_number,customer_email,delivery_name,currency,final_total")
      .in("id", orderIds);
    if (orderError) throw new Error("Return request orders unavailable.");
    for (const order of orders ?? []) orderMap.set(order.id, order);
  }

  return {
    requests: requests.map((request) => ({
      ...request,
      order: orderMap.get(request.order_id) ?? null,
    })),
    count: count ?? 0,
    page,
  };
}

export async function adminReturnRequest(requestId: string) {
  const { client } = await requirePage(true);
  const safeId = id(requestId, "return request");
  const { data: request, error } = await client
    .from("return_requests")
    .select("*")
    .eq("id", safeId)
    .maybeSingle();

  if (error) throw new Error("Return request unavailable.");
  if (!request) return null;

  const [{ data: order, error: orderError }, { data: requestItems, error: requestItemsError }] = await Promise.all([
    client
      .from("orders")
      .select("id,order_number,customer_email,delivery_name,delivery_phone,currency,final_total,payment_status,fulfillment_status,is_test,created_at")
      .eq("id", request.order_id)
      .maybeSingle(),
    client
      .from("return_request_items")
      .select("order_item_id,quantity")
      .eq("return_request_id", request.id),
  ]);

  if (orderError || !order) throw new Error("Return request order unavailable.");
  if (requestItemsError) throw new Error("Return request items unavailable.");

  const orderItemIds = (requestItems ?? []).map((entry) => entry.order_item_id);
  const orderItemMap = new Map<string, {
    id: string;
    product_name: string;
    sku: string;
    size: string;
    color: string;
    unit_price: number;
    quantity: number;
    line_total: number;
  }>();

  if (orderItemIds.length) {
    const { data: orderItems, error: orderItemsError } = await client
      .from("order_items")
      .select("id,product_name,sku,size,color,unit_price,quantity,line_total")
      .in("id", orderItemIds);
    if (orderItemsError) throw new Error("Return request item details unavailable.");
    for (const item of orderItems ?? []) orderItemMap.set(item.id, item);
  }

  return {
    ...request,
    order,
    items: (requestItems ?? []).map((entry) => ({
      ...entry,
      order_item: orderItemMap.get(entry.order_item_id) ?? null,
    })),
  };
}
