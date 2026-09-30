"use client";

import { useActionState } from "react";
import type { Product } from "@/lib/catalog";
import { setWishlist } from "@/app/account/wishlist/actions";
import styles from "./wishlist-button.module.css";

const initialState = { ok: false, message: "" };

export function WishlistButton({ product, saved }: { product: Product; saved: boolean }) {
  const [state, action, pending] = useActionState(setWishlist, initialState);
  return (
    <form className={styles.form} action={action}>
      <input type="hidden" name="product_id" value={product.id} />
      <input type="hidden" name="product_slug" value={product.slug} />
      <input type="hidden" name="mode" value={saved ? "remove" : "add"} />
      <button className={styles.button} type="submit" disabled={pending}>
        {pending ? "SAVING…" : saved ? "♥ SAVED · REMOVE" : "♡ SAVE TO WISHLIST"}
      </button>
      <p className={styles.message} role="status">{state.message}</p>
    </form>
  );
}
