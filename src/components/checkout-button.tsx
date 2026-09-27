"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "./cart-provider";
import { Button } from "./ui";

export function CheckoutButton() {
  const cart = useCart();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function startCheckout() {
    if (pending || cart.busy || cart.error || !cart.quote.lines.length) return;
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.quote.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            size: line.size,
            color: line.color,
            quantity: line.quantity,
            observedPrice: line.price,
          })),
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        url?: string;
        message?: string;
      };
      if (response.status === 401) {
        router.push("/login?next=/cart");
        return;
      }
      if (!response.ok || !data.url) {
        setMessage(data.message || "Checkout could not be started.");
        return;
      }
      window.location.assign(data.url);
    } catch {
      setMessage("Checkout could not be started. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="checkout-actions">
      <Button type="button" disabled={pending || cart.busy || !!cart.error} onClick={startCheckout}>
        {pending ? "OPENING TEST CHECKOUT…" : "TEST CHECKOUT ↗"}
      </Button>
      <p className="muted">Stripe test mode only. No real money is charged.</p>
      {message ? (
        <p role="alert" className="form-error">
          {message}{" "}
          {message.startsWith("Add a default delivery address") ? (
            <Link href="/account/addresses">ADD ADDRESS ↗</Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
