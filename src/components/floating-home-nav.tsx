"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import styles from "./floating-home-nav.module.css";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const mix = (from: number, to: number, progress: number) =>
  from + (to - from) * progress;

export function FloatingHomeNav() {
  const navRef = useRef<HTMLElement>(null);
  const brandRef = useRef<HTMLAnchorElement>(null);
  const shopRef = useRef<HTMLAnchorElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    const brand = brandRef.current;
    const shop = shopRef.current;
    const shell = shellRef.current;
    if (!nav || !brand || !shop || !shell) return;

    document.body.classList.add("kultura-tinker-home");

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;

    const update = () => {
      frame = 0;
      const viewport = window.innerWidth;
      const side = viewport <= 720 ? 14 : Math.max(22, Math.min(54, viewport * 0.035));
      const gap = viewport <= 420 ? 6 : 8;
      const threshold = Math.max(240, Math.min(520, window.innerHeight * 0.56));
      const raw = reduced ? (window.scrollY > 44 ? 1 : 0) : clamp01(window.scrollY / threshold);
      const progress = raw * raw * (3 - 2 * raw);

      const brandWidth = brand.offsetWidth;
      const shopWidth = shop.offsetWidth;
      const initialWidth = brandWidth + shopWidth + gap;
      const initialLeft = (viewport - initialWidth) / 2;

      const brandLeft = mix(initialLeft, side, progress);
      const shopLeft = mix(initialLeft + brandWidth + gap, viewport - side - shopWidth, progress);

      nav.dataset.ready = "true";
      nav.style.setProperty("--nav-progress", progress.toFixed(4));
      brand.style.transform = `translate3d(${brandLeft}px, 0, 0)`;
      shop.style.transform = `translate3d(${shopLeft}px, 0, 0)`;
      shell.style.width = `${initialWidth + 14}px`;
      shell.style.opacity = `${1 - progress}`;
      shell.style.transform = `translate3d(-50%, 0, 0) scaleX(${1 + progress * 0.035})`;
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      document.body.classList.remove("kultura-tinker-home");
    };
  }, []);

  return (
    <nav
      ref={navRef}
      className={styles.nav}
      aria-label="KULTURA quick navigation"
      data-kultura-floating-nav
    >
      <div ref={shellRef} className={styles.shell} aria-hidden="true" />
      <Link ref={brandRef} href="/" className={styles.brand} aria-label="KULTURA home">
        <span aria-hidden="true">✳</span>
        KULTURA
      </Link>
      <Link ref={shopRef} href="/shop" className={styles.shop}>
        SHOP
      </Link>
    </nav>
  );
}
