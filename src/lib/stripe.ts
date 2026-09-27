import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { siteOrigin } from "./supabase/config";

export type StripeCheckoutSession = {
  id: string;
  url: string | null;
  payment_status: string | null;
  amount_total: number | null;
  currency: string | null;
  metadata: Record<string, string> | null;
};

export type StripeWebhookEvent = {
  id: string;
  type: string;
  data: { object: StripeCheckoutSession };
};

export type StripeLine = {
  name: string;
  unitAmount: number;
  quantity: number;
};

function stripeSecretKey() {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key.startsWith("sk_test_") || key.length < 20)
    throw new Error("Stripe test mode is not configured.");
  return key;
}

async function stripeRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch("https://api.stripe.com/v1" + path, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: "Bearer " + stripeSecretKey(),
      ...(init.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Stripe request failed.");
  return (await response.json()) as T;
}

export async function createTestCheckoutSession(input: {
  orderId: string;
  customerId: string;
  customerEmail: string;
  lines: StripeLine[];
}) {
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("payment_method_types[0]", "card");
  params.set("customer_email", input.customerEmail);
  params.set("client_reference_id", input.orderId);
  params.set("success_url", siteOrigin() + "/checkout/success?session_id={CHECKOUT_SESSION_ID}");
  params.set("cancel_url", siteOrigin() + "/checkout/cancelled");
  params.set("metadata[order_id]", input.orderId);
  params.set("metadata[customer_id]", input.customerId);
  params.set("payment_intent_data[metadata][order_id]", input.orderId);
  params.set("payment_intent_data[metadata][customer_id]", input.customerId);

  input.lines.forEach((line, index) => {
    params.set(`line_items[${index}][quantity]`, String(line.quantity));
    params.set(`line_items[${index}][price_data][currency]`, "gel");
    params.set(`line_items[${index}][price_data][unit_amount]`, String(line.unitAmount));
    params.set(`line_items[${index}][price_data][product_data][name]`, line.name.slice(0, 120));
  });

  const session = await stripeRequest<StripeCheckoutSession>("/checkout/sessions", {
    method: "POST",
    body: params,
  });
  if (!session.id.startsWith("cs_test_") || !session.url?.startsWith("https://checkout.stripe.com/"))
    throw new Error("Stripe returned an invalid test checkout session.");
  return session;
}

export async function retrieveTestCheckoutSession(id: string) {
  if (!/^cs_test_[A-Za-z0-9_]+$/.test(id)) throw new Error("Invalid Stripe test session.");
  return stripeRequest<StripeCheckoutSession>("/checkout/sessions/" + encodeURIComponent(id));
}

export function verifyStripeWebhook(rawBody: string, signatureHeader: string | null): StripeWebhookEvent {
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!secret.startsWith("whsec_") || secret.length < 20 || !signatureHeader)
    throw new Error("Stripe webhook is not configured.");

  let timestamp = "";
  const signatures: string[] = [];
  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.trim().split("=", 2);
    if (key === "t") timestamp = value ?? "";
    if (key === "v1" && value) signatures.push(value);
  }
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300)
    throw new Error("Stripe webhook timestamp is invalid.");

  const expected = createHmac("sha256", secret).update(timestamp + "." + rawBody).digest();
  const valid = signatures.some((signature) => {
    try {
      const candidate = Buffer.from(signature, "hex");
      return candidate.length === expected.length && timingSafeEqual(candidate, expected);
    } catch {
      return false;
    }
  });
  if (!valid) throw new Error("Stripe webhook signature is invalid.");

  const event = JSON.parse(rawBody) as StripeWebhookEvent;
  if (!event || typeof event.id !== "string" || typeof event.type !== "string" || !event.data?.object)
    throw new Error("Stripe webhook payload is invalid.");
  return event;
}
