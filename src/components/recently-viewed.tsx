"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { money, type Product } from "@/lib/catalog";
import styles from "./recently-viewed.module.css";

type RecentProduct = Pick<Product, "slug" | "name" | "price" | "image" | "category">;
const STORAGE_KEY = "kultura:recent-products";

function readRecentSlugs() {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];
    const slugs = stored.flatMap((item: unknown) => {
      // Previous versions stored a full product snapshot.
      const slug = typeof item === "string"
        ? item
        : item && typeof item === "object" && "slug" in item
          ? item.slug
          : undefined;
      return typeof slug === "string" && slug.length <= 120 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)
        ? [slug]
        : [];
    });
    return [...new Set(slugs)].slice(0, 8);
  } catch {
    return [];
  }
}

export function RecentlyViewed({ product }: { product: Product }) {
  const slug = product.slug;
  const [recent, setRecent] = useState<{ forSlug: string; items: RecentProduct[] }>();
  const items = recent?.forSlug === slug ? recent.items : [];

  useEffect(() => {
    const previous = readRecentSlugs().filter((item) => item !== slug);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([slug, ...previous].slice(0, 8)));
    } catch {
      // Browsing history is optional when local storage is disabled.
    }
    if (!previous.length) return;

    const controller = new AbortController();
    const query = new URLSearchParams({ slugs: previous.join(",") });
    const load = async () => {
      try {
        const response = await fetch(`/api/catalog/recent?${query}`, { signal: controller.signal });
        if (!response.ok || controller.signal.aborted) return;
        const data = await response.json() as { products: RecentProduct[] };
        if (!controller.signal.aborted) {
          setRecent({ forSlug: slug, items: data.products.slice(0, 4) });
        }
      } catch {
        // Hide unverified history if the catalog is unavailable.
      }
    };
    void load();
    return () => controller.abort();
  }, [slug]);

  if (!items.length) return null;
  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <div>
          <p className="eyebrow">YOUR HISTORY</p>
          <h2>RECENTLY VIEWED</h2>
        </div>
      </div>
      <div className={styles.grid}>
        {items.map((item) => (
          <Link className={styles.card} href={`/product/${item.slug}`} key={item.slug}>
            <div className={styles.image}>
              <Image src={item.image} alt={item.name} fill sizes="(max-width: 760px) 50vw, 25vw" />
            </div>
            <div className={styles.meta}>
              <strong>{item.name.replace("KULTURA ", "")}</strong>
              <span>{money(item.price)}</span>
            </div>
            <p className={styles.category}>{item.category.toUpperCase()}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
