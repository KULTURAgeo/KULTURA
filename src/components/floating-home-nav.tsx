"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";
import styles from "./floating-home-nav.module.css";
import { useLanguage } from "./language-provider";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function FloatingHomeNav() {
  const { t } = useLanguage();
  const navRef = useRef<HTMLElement>(null);
  const brandRef = useRef<HTMLAnchorElement>(null);
  const shopRef = useRef<HTMLAnchorElement>(null);
  const tagRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    const brand = brandRef.current;
    const shop = shopRef.current;
    const tag = tagRef.current;
    if (!nav || !brand || !shop || !tag) return;

    let raf = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const render = () => {
      raf = 0;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const side = vw < 720 ? 12 : clamp(vw * 0.028, 20, 48);
      const gap = vw < 520 ? 7 : 9;
      const travel = Math.max(280, vh * 0.48);
      const raw = clamp(window.scrollY / travel, 0, 1);
      const p = reduced ? (window.scrollY > 20 ? 1 : 0) : raw * raw * (3 - 2 * raw);

      const bw = brand.offsetWidth;
      const sw = shop.offsetWidth;
      const total = bw + sw + gap;
      const startX = (vw - total) / 2;
      const brandX = startX + (side - startX) * p;
      const shopStart = startX + bw + gap;
      const shopEnd = vw - side - sw;
      const shopX = shopStart + (shopEnd - shopStart) * p;

      brand.style.transform = `translate3d(${brandX}px,0,0)`;
      shop.style.transform = `translate3d(${shopX}px,0,0)`;
      tag.style.opacity = String(1 - clamp(p * 1.7, 0, 1));
      tag.style.transform = `translate3d(-50%, ${-8 * p}px, 0)`;
      nav.dataset.ready = "true";
    };

    const requestRender = () => {
      if (!raf) raf = requestAnimationFrame(render);
    };

    render();
    addEventListener("scroll", requestRender, { passive: true });
    addEventListener("resize", requestRender);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      removeEventListener("scroll", requestRender);
      removeEventListener("resize", requestRender);
    };
  }, []);

  return (
    <nav ref={navRef} className={styles.nav} aria-label="KULTURA quick navigation">
      <Link ref={brandRef} href="/" className={styles.brand} aria-label="KULTURA home">
        <Image
          src="/images/kultura-chrome-oval-nav.svg"
          alt=""
          width={240}
          height={86}
          className={styles.brandLogo}
          priority
          unoptimized
        />
      </Link>
      <Link ref={shopRef} href="/shop" className={styles.shop}>{t("SHOP")}</Link>
      <span ref={tagRef} className={styles.tag}>{t("STREETWEAR / GEORGIA")}</span>
    </nav>
  );
}
