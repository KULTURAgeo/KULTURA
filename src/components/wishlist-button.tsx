"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import type { Product } from "@/lib/catalog";
import {
  getWishlistState,
  setWishlist,
} from "@/app/account/wishlist/actions";
import styles from "./wishlist-button.module.css";

export function WishlistButton({
  product,
}: {
  product: Product;
  saved?: boolean;
}) {
  const [saved, setSaved] = useState<boolean | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

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
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (saved === null || authenticated !== true || pending) return;
        const form = event.currentTarget;
        const nextSaved = !saved;
        startTransition(async () => {
          const result = await setWishlist(
            { ok: false, message: "" },
            new FormData(form),
          );
          setMessage(result.message ?? "");
          if (result.ok) setSaved(nextSaved);
        });
      }}
    >
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
        {message}
      </p>
    </form>
  );
}
