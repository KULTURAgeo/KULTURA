"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { ProductImage } from "@/lib/catalog";
import { useLanguage } from "./language-provider";
import styles from "./product-card-preview.module.css";

export function ProductCardPreview({ href, name, photos, badges, children }: {
  href: string;
  name: string;
  photos: readonly ProductImage[];
  badges: ReactNode;
  children: ReactNode;
}) {
  const { locale } = useLanguage();
  const [index, setIndex] = useState(0);
  const count = photos.length;
  const current = index < count ? index : 0;
  const photo = photos[current];
  const isKa = locale === "ka";

  function changePhoto(offset: number) {
    setIndex((previous) => ((previous < count ? previous : 0) + offset + count) % count);
  }

  return (
    <div className={styles.card}>
      <Link className={styles.link} href={href} prefetch={false}>
        <div className="product-image">
          <Image
            src={photo.src}
            alt={photo.alt}
            className={styles.photo}
            fill
            quality={90}
            sizes="(max-width: 360px) calc(100vw - 40px), (max-width: 767px) calc(50vw - 26px), (max-width: 1375px) 32vw, 440px"
          />
          <div className="product-badge">{badges}</div>
          <span className="product-arrow" aria-hidden="true">↗</span>
        </div>
        {children}
      </Link>
      {count > 1 && (
        <div className={styles.controls} role="group" aria-label={isKa ? `${name} — ფოტოები` : `${name} photos`}>
          <button className={styles.previous} type="button"
            aria-label={isKa ? "წინა ფოტო" : "Previous photo"} onClick={() => changePhoto(-1)}>
            <span aria-hidden="true">‹</span>
          </button>
          <button className={styles.next} type="button"
            aria-label={isKa ? "შემდეგი ფოტო" : "Next photo"} onClick={() => changePhoto(1)}>
            <span aria-hidden="true">›</span>
          </button>
          <span className={styles.count} role="status">
            <span aria-hidden="true">{current + 1} / {count}</span>
            <span className="sr-only">{isKa ? `ფოტო ${current + 1}, სულ ${count}` : `Photo ${current + 1} of ${count}`}</span>
          </span>
        </div>
      )}
    </div>
  );
}
