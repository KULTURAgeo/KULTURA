import "server-only";
import type { StripeCheckoutSession } from "./stripe";
import { createAdminClient } from "./supabase/admin";

export async function applyTestCheckoutSession(session: StripeCheckoutSession) {
  const orderId = session.metadata?.order_id;
  const customerId = session.metadata?.customer_id;
  if (!orderId || !customerId) return { ok: false as const, reason: "metadata" };

  const admin = createAdminClient();
  if (!admin) return { ok: false as const, reason: "configuration" };
  const { data: order, error } = await admin
    .from("orders")
    .select("id,customer_id,currency,final_total,payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !order) return { ok: false as const, reason: "order" };
  if (order.customer_id !== customerId)
    return { ok: false as const, reason: "customer" };
  if (
    session.amount_total !== order.final_total ||
    session.currency?.toUpperCase() !== order.currency
  )
    return { ok: false as const, reason: "amount" };
  if (order.payment_status === "paid") return { ok: true as const, orderId };
  if (session.payment_status !== "paid")
    return { ok: false as const, reason: "unpaid" };

  const { error: updateError } = await admin
    .from("orders")
    .update({ payment_status: "paid", paid_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("payment_status", "pending");
  if (updateError) return { ok: false as const, reason: "update" };
  return { ok: true as const, orderId };
}

export async function cancelPendingTestOrder(orderId: string) {
  const admin = createAdminClient();
  if (!admin) return false;
  const { error } = await admin
    .from("orders")
    .update({ payment_status: "cancelled" })
    .eq("id", orderId)
    .eq("payment_status", "pending");
  return !error;
}
