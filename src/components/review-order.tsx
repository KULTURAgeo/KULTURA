"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useCart } from "@/components/cart-provider";
import { MAX_QUANTITY } from "@/lib/cart/model";
import { money } from "@/lib/catalog";

export type ReviewShippingSettings = {
  shippingTotal: number;
  freeShippingThreshold: number | null;
};

export function ReviewOrder({
  shippingSettings,
  testCheckoutEnabled,
}: {
  shippingSettings: ReviewShippingSettings;
  testCheckoutEnabled: boolean;
}) {
  const cart = useCart();
  const { ready, busy, refresh } = cart;

  useEffect(() => {
    if (!ready && !busy) void refresh();
  }, [ready, busy, refresh]);

  const shipping = useMemo(() => {
    if (!cart.quote.lines.length) return 0;
    if (
      shippingSettings.freeShippingThreshold !== null &&
      cart.quote.subtotal >= shippingSettings.freeShippingThreshold
    ) {
      return 0;
    }
    return shippingSettings.shippingTotal;
  }, [
    cart.quote.lines.length,
    cart.quote.subtotal,
    shippingSettings.freeShippingThreshold,
    shippingSettings.shippingTotal,
  ]);

  const unavailable = cart.quote.lines.some((line) => !line.available);
  const canContinue =
    cart.ready &&
    !cart.busy &&
    !cart.error &&
    cart.quote.lines.length > 0 &&
    !unavailable;
  const total = cart.quote.subtotal + shipping;

  return (
    <div className="review-order-shell" aria-busy={cart.busy}>
      <div className="checkout-progress" aria-label="Checkout progress">
        <span className="complete">01 BAG</span>
        <span className="active">02 REVIEW</span>
        <span>03 CHECKOUT</span>
      </div>

      <div className="review-order-grid">
        <section className="review-order-panel" aria-labelledby="review-items-title">
          <div className="review-order-heading">
            <div>
              <p className="eyebrow">REVIEW ORDER</p>
              <h2 id="review-items-title">YOUR PIECES</h2>
            </div>
            <Link className="text-link" href="/cart">
              EDIT BAG ↗
            </Link>
          </div>

          {!cart.ready ? <p role="status">Refreshing prices and stock…</p> : null}
          {cart.error ? (
            <div role="alert" className="review-order-error">
              <p>{cart.error}</p>
              <button
                type="button"
                className="button secondary"
                onClick={() => void cart.refresh()}
                disabled={cart.busy}
              >
                TRY AGAIN
              </button>
            </div>
          ) : null}

          {cart.ready && !cart.quote.lines.length && !cart.error ? (
            <div className="empty-state">
              <p>Your bag is empty.</p>
              <Link className="button" href="/shop">
                BROWSE SHOP ↗
              </Link>
            </div>
          ) : null}

          <div className="review-order-list">
            {cart.quote.lines.map((line) => (
              <article className="review-order-item" key={line.variantId}>
                <Link
                  className="review-order-image"
                  href={line.slug ? `/product/${line.slug}` : "/shop"}
                >
                  <Image
                    src={line.image}
                    alt={line.name}
                    width={120}
                    height={150}
                  />
                </Link>
                <div className="review-order-item-info">
                  <div>
                    <strong>{line.name}</strong>
                    <span>{line.color} / {line.size}</span>
                    <span>{money(line.price)} each</span>
                  </div>
                  {line.notice ? (
                    <p className="muted" role="status">{line.notice}</p>
                  ) : null}
                  <div className="quantity-control review-quantity-control">
                    <button
                      type="button"
                      aria-label={`Decrease quantity for ${line.name}`}
                      disabled={cart.busy || line.quantity <= 1 || !line.available}
                      onClick={() =>
                        void cart.setQuantity(line.variantId, line.quantity - 1)
                      }
                    >
                      −
                    </button>
                    <output aria-label="Quantity">{line.quantity}</output>
                    <button
                      type="button"
                      aria-label={`Increase quantity for ${line.name}`}
                      disabled={
                        cart.busy ||
                        !line.available ||
                        line.quantity >= Math.min(line.stock, MAX_QUANTITY)
                      }
                      onClick={() =>
                        void cart.setQuantity(line.variantId, line.quantity + 1)
                      }
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="remove-item"
                      disabled={cart.busy}
                      onClick={() => void cart.remove(line.variantId)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <strong className="review-order-line-total">
                  {line.available ? money(line.lineTotal) : "UNAVAILABLE"}
                </strong>
              </article>
            ))}
          </div>
        </section>

        <aside className="review-order-summary" aria-labelledby="review-total-title">
          <p className="eyebrow">ORDER TOTAL</p>
          <h2 id="review-total-title">SUMMARY</h2>
          <div className="review-total-lines">
            <div>
              <span>SUBTOTAL</span>
              <strong>{money(cart.quote.subtotal)}</strong>
            </div>
            <div>
              <span>DELIVERY</span>
              <strong>{shipping === 0 ? "FREE" : money(shipping)}</strong>
            </div>
            <div className="review-total-final">
              <span>TOTAL</span>
              <strong>{money(total)}</strong>
            </div>
          </div>

          {shippingSettings.freeShippingThreshold !== null ? (
            <p className="muted">
              Delivery becomes free from {money(shippingSettings.freeShippingThreshold)}.
            </p>
          ) : null}
          <p className="muted">
            Promo codes can be applied on the next step and may reduce this total.
          </p>
          {testCheckoutEnabled ? (
            <p className="muted">
              Admin test checkout may recalculate delivery after the address is selected.
            </p>
          ) : null}
          {unavailable ? (
            <p className="form-error" role="alert">
              Remove unavailable items before continuing.
            </p>
          ) : null}

          {canContinue ? (
            <Link className="button review-order-continue" href="/checkout">
              CONTINUE TO CHECKOUT ↗
            </Link>
          ) : (
            <button className="button review-order-continue" type="button" disabled>
              CHECKOUT UNAVAILABLE
            </button>
          )}
          <Link className="text-link review-order-back" href="/shop">
            CONTINUE SHOPPING
          </Link>
        </aside>
      </div>
    </div>
  );
}
