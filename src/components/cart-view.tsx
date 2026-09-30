"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useCart } from "./cart-provider";
import { money } from "@/lib/catalog";
import { MAX_QUANTITY } from "@/lib/cart/model";
import { Button, Icon } from "./ui";

export function CartContents({ compact = false }: { compact?: boolean }) {
  const cart = useCart();
  const { ready, busy, refresh } = cart;

  useEffect(() => {
    if (!ready && !busy) void refresh();
  }, [ready, busy, refresh]);

  const canCheckout =
    cart.ready &&
    !cart.error &&
    cart.quote.lines.length > 0 &&
    cart.quote.lines.every((line) => line.available);

  return (
    <div className="cart-content" aria-busy={cart.busy}>
      {!cart.ready ? <p role="status">Loading your bag…</p> : null}

      {cart.error ? (
        <div role="alert">
          <p>{cart.error}</p>
          <Button onClick={() => void cart.refresh()} disabled={cart.busy}>
            TRY AGAIN
          </Button>
        </div>
      ) : null}

      {cart.ready && !cart.quote.lines.length && !cart.error ? (
        <div className="empty-state">
          <p>Your bag is waiting.</p>
          <Link className="text-link" href="/shop" onClick={cart.close}>
            EXPLORE THE COLLECTION ↗
          </Link>
        </div>
      ) : null}

      {cart.quote.lines.map((line) => (
        <article className="cart-line" key={line.variantId}>
          <Image src={line.image} alt={line.name} width={110} height={140} />
          <div className="cart-line-info">
            {line.slug ? (
              <Link href={`/product/${line.slug}`} onClick={cart.close}>
                {line.name}
              </Link>
            ) : (
              <strong>{line.name}</strong>
            )}
            <p>{line.color} / {line.size}</p>
            <p>{line.available ? money(line.price) : "Unavailable"}</p>
            {line.notice ? <p className="muted" role="status">{line.notice}</p> : null}
            <div className="quantity-control">
              <button
                aria-label={`Decrease quantity for ${line.name}`}
                disabled={cart.busy || line.quantity <= 1 || !line.available}
                onClick={() => void cart.setQuantity(line.variantId, line.quantity - 1)}
              >
                −
              </button>
              <output aria-label="Quantity">{line.quantity}</output>
              <button
                aria-label={`Increase quantity for ${line.name}`}
                disabled={cart.busy || !line.available || line.quantity >= Math.min(line.stock, MAX_QUANTITY)}
                onClick={() => void cart.setQuantity(line.variantId, line.quantity + 1)}
              >
                +
              </button>
              <button
                className="remove-item"
                disabled={cart.busy}
                onClick={() => void cart.remove(line.variantId)}
              >
                Remove
              </button>
            </div>
          </div>
          <span>{line.available ? money(line.lineTotal) : "—"}</span>
        </article>
      ))}

      {!!cart.quote.lines.length ? (
        <div className="cart-total">
          <div>
            <span>SUBTOTAL</span>
            <strong>{cart.error ? "Refresh required" : money(cart.quote.subtotal)}</strong>
          </div>
          <p className="muted">
            Prices and availability are refreshed from the store. Delivery is calculated at checkout. Items are not reserved.
          </p>

          {compact ? (
            <Link className="button" href="/cart" onClick={cart.close}>VIEW YOUR BAG ↗</Link>
          ) : canCheckout ? (
            <Link className="button" href="/checkout">PROCEED TO CHECKOUT ↗</Link>
          ) : (
            <Button disabled>CHECKOUT UNAVAILABLE</Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function CartDrawer() {
  const cart = useCart();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (cart.drawerOpen && !dialog.current?.open) dialog.current?.showModal();
    else if (!cart.drawerOpen && dialog.current?.open) dialog.current.close();
  }, [cart.drawerOpen]);

  return (
    <dialog
      ref={dialog}
      className="cart-drawer"
      aria-labelledby="bag-title"
      onClose={cart.close}
      onClick={(event) => {
        if (event.target === event.currentTarget) cart.close();
      }}
    >
      <div className="drawer-heading">
        <h2 id="bag-title">YOUR BAG</h2>
        <button className="icon-button" aria-label="Close bag" onClick={cart.close}>
          <Icon name="close" />
        </button>
      </div>
      <CartContents compact />
    </dialog>
  );
}
