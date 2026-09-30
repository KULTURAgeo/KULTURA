"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import type { Product } from "@/lib/catalog";
import {
  getWishlistState,
  setWishlist,
} from "@/app/account/wishlist/actions";
import styles from "./wishlist-button.module.css";

const initialState = { ok: false, message: "" };

export function WishlistButton({ product }: { product: Product }) {
  const [state, action, pending] = useActionState(setWishlist, initialState);
  const [saved, setSaved] = useState<boolean | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getWishlistState(product.id).then((result) => {
      if (cancelled) return;
      setAuthenticated(result.authenticated);
      setSaved(result.saved);
    });
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  useEffect(() => {
    if (!state.ok) return;
    setSaved((current) => (current === null ? current : !current));
  }, [state]);

  if (authenticated === false) {
    return (
      <div className={styles.form}>
        <Link
          className={styles.button}
          href={`/login?next=${encodeURIComponent(`/product/${product.slug}`)}`}
        >
          ♡ SIGN IN TO SAVE
        </Link>
        <p className={styles.message} role="status" />
      </div>
    );
  }

  return (
    <form className={styles.form} action={action}>
      <input type="hidden" name="product_id" value={product.id} />
      <input type="hidden" name="product_slug" value={product.slug} />
      <input type="hidden" name="mode" value={saved ? "remove" : "add"} />
      <button
        className={styles.button}
        type="submit"
        disabled={pending || saved === null || authenticated === null}
      >
        {pending
          ? "SAVING…"
          : saved === null || authenticated === null
            ? "CHECKING WISHLIST…"
            : saved
              ? "♥ SAVED · REMOVE"
              : "♡ SAVE TO WISHLIST"}
      </button>
      <p className={styles.message} role="status">
        {state.message}
      </p>
    </form>
  );
}
