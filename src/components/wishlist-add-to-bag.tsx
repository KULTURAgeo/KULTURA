"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/lib/catalog";
import { useCart } from "@/components/cart-provider";

export function WishlistAddToBag({ product }: { product: Product }) {
  const cart = useCart();
  const variants = useMemo(
    () => product.variants.filter((variant) => variant.stock > 0),
    [product.variants],
  );
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const variant = variants.find((item) => item.id === variantId) ?? null;

  if (!variants.length) {
    return <p className="muted">SOLD OUT</p>;
  }

  return (
    <div>
      <div className="wishlist-quick-add">
        <select
          aria-label={`Choose size and color for ${product.name}`}
          value={variantId}
          onChange={(event) => {
            setVariantId(event.target.value);
            setMessage("");
          }}
        >
          {variants.map((item) => (
            <option value={item.id} key={item.id}>
              {item.color} / {item.size} · {item.stock} left
            </option>
          ))}
        </select>
        <button
          type="button"
          className="button secondary"
          disabled={!variant || cart.busy}
          onClick={async () => {
            if (!variant) return;
            const ok = await cart.add({
              productId: product.id,
              variantId: variant.id,
              size: variant.size,
              color: variant.color,
              quantity: 1,
              observedPrice: product.price,
            });
            setMessage(ok ? "Added to bag." : "Could not add this piece.");
          }}
        >
          {cart.busy ? "ADDING…" : "ADD TO BAG"}
        </button>
      </div>
      {message ? <p className="muted" role="status">{message}</p> : null}
    </div>
  );
}
