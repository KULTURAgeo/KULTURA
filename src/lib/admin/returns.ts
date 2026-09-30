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
    .select(
      "id,order_id,request_type,reason,status,created_at,updated_at,order:orders(id,order_number,customer_email,delivery_name,currency,final_total)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("id");

  if (isReturnStatus(filters.status)) query = query.eq("status", filters.status);
  if (isReturnType(filters.type)) query = query.eq("request_type", filters.type);

  const { data, count, error } = await query.range((page - 1) * 25, page * 25 - 1);
  if (error) throw new Error("Return requests unavailable.");

  return {
    requests: data ?? [],
    count: count ?? 0,
    page,
  };
}

export async function adminReturnRequest(requestId: string) {
  const { client } = await requirePage(true);
  const safeId = id(requestId, "return request");

  // One relational query replaces the old request -> order/request-items ->
  // order-item-details fanout while preserving the same returned shape.
  const { data, error } = await client
    .from("return_requests")
    .select(
      "id,order_id,request_type,reason,details,status,admin_note,created_at,updated_at,order:orders!inner(id,order_number,customer_email,delivery_name,delivery_phone,currency,final_total,payment_status,fulfillment_status,is_test,created_at),items:return_request_items(order_item_id,quantity,order_item:order_items(id,product_name,sku,size,color,unit_price,quantity,line_total))",
    )
    .eq("id", safeId)
    .maybeSingle();

  if (error) throw new Error("Return request unavailable.");
  return data;
}
