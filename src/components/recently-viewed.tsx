"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { money, type Product } from "@/lib/catalog";
import styles from "./recently-viewed.module.css";

type RecentProduct = Pick<Product, "slug" | "name" | "price" | "image" | "category">;
const STORAGE_KEY = "kultura:recent-products";

function parseRecent(value: string | null): RecentProduct[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<RecentProduct>;
      if (
        typeof candidate.slug !== "string" ||
        typeof candidate.name !== "string" ||
        typeof candidate.price !== "number" ||
        typeof candidate.image !== "string" ||
        typeof candidate.category !== "string"
      ) return [];
      return [candidate as RecentProduct];
    }).slice(0, 8);
  } catch {
    return [];
  }
}

export function RecentlyViewed({ product }: { product: Product }) {
  const [items, setItems] = useState<RecentProduct[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = parseRecent(window.localStorage.getItem(STORAGE_KEY));
      const previous = stored.filter((item) => item.slug !== product.slug);
      setItems(previous.slice(0, 4));
      const current: RecentProduct = {
        slug: product.slug,
        name: product.name,
        price: product.price,
        image: product.image,
        category: product.category,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([current, ...previous].slice(0, 8)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [product.slug, product.name, product.price, product.image, product.category]);

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
