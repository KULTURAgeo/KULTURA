import { NextResponse } from "next/server";
import { applyTestCheckoutSession, cancelPendingTestOrder } from "@/lib/checkout";
import { verifyStripeWebhook } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.text();
  let event;
  try {
    event = verifyStripeWebhook(payload, request.headers.get("stripe-signature"));
  } catch {
    return NextResponse.json({ received: false }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const result = await applyTestCheckoutSession(event.data.object);
    if (!result.ok) console.error("[stripe] checkout completion not applied", result.reason);
  } else if (event.type === "checkout.session.expired") {
    const orderId = event.data.object.metadata?.order_id;
    if (orderId) await cancelPendingTestOrder(orderId);
  }
  return NextResponse.json({ received: true });
}
