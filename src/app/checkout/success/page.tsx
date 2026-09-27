import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui";
import { ClearCartAfterTestPayment } from "@/components/checkout-success-client";
import { requirePage } from "@/lib/auth/guards";
import { applyTestCheckoutSession } from "@/lib/checkout";
import { retrieveTestCheckoutSession } from "@/lib/stripe";
import { money } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: "Test payment complete", robots: { index: false, follow: false } };

export default async function CheckoutSuccess({ searchParams }: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { client, user } = await requirePage();
  const sessionId = (await searchParams).session_id ?? "";
  if (!/^cs_test_[A-Za-z0-9_]+$/.test(sessionId)) notFound();

  let session;
  try {
    session = await retrieveTestCheckoutSession(sessionId);
  } catch {
    return <Container className="page-section"><h1>PAYMENT CHECK</h1><p role="alert">We could not verify this test payment yet.</p><Link className="text-link" href="/account/orders">VIEW ORDERS ↗</Link></Container>;
  }
  if (session.metadata?.customer_id !== user.id) notFound();
  const applied = await applyTestCheckoutSession(session);
  const orderId = session.metadata?.order_id;
  const { data: order } = orderId
    ? await client.from("orders").select("order_number,final_total,currency,payment_status").eq("id", orderId).eq("customer_id", user.id).maybeSingle()
    : { data: null };

  return (
    <Container className="page-section">
      {applied.ok && <ClearCartAfterTestPayment />}
      <p className="eyebrow">STRIPE TEST MODE</p>
      <h1 className="page-title">PAYMENT {applied.ok ? "SUCCESSFUL" : "RECEIVED"}</h1>
      <p>{order ? `${order.order_number} — ${money(order.final_total)}` : "Your test payment was returned from Stripe."}</p>
      <p className="muted">No real money was charged. This checkout is intentionally locked to Stripe test keys.</p>
      {!applied.ok ? <p role="status">The order may still be waiting for the Stripe webhook. Check your orders again shortly.</p> : null}
      <div className="inline-links"><Link className="text-link" href="/account/orders">VIEW ORDERS ↗</Link><Link className="text-link" href="/shop">CONTINUE SHOPPING ↗</Link></div>
    </Container>
  );
}
