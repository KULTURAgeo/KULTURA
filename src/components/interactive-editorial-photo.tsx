"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, type PointerEvent } from "react";
import styles from "./interactive-editorial-photo.module.css";

type Props = {
  image: string;
  alt: string;
  href: string;
  label: string;
  sizes: string;
  featured?: boolean;
};

/**
 * Small responsive touch surface. The outer scene cards keep the original
 * scroll-controlled transforms; this nested element owns its independent
 * pointer-driven 3D tilt and lighting, so the phone/globe choreography survives.
 */
export function InteractiveEditorialPhoto({
  image,
  alt,
  href,
  label,
  sizes,
  featured = false,
}: Props) {
  const card = useRef<HTMLAnchorElement>(null);

  function track(event: PointerEvent<HTMLAnchorElement>) {
    const element = card.current;
    if (!element) return;
    if (event.pointerType === "touch" && event.buttons === 0) return;
    const rect = element.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1)));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(rect.height, 1)));
    element.style.setProperty("--touch-x", (x * 100).toFixed(1) + "%");
    element.style.setProperty("--touch-y", (y * 100).toFixed(1) + "%");
    element.style.setProperty("--photo-rx", ((0.5 - y) * 13).toFixed(2) + "deg");
    element.style.setProperty("--photo-ry", ((x - 0.5) * 15).toFixed(2) + "deg");
    element.style.setProperty("--photo-shift-x", ((x - 0.5) * -9).toFixed(1) + "px");
    element.style.setProperty("--photo-shift-y", ((y - 0.5) * -9).toFixed(1) + "px");
  }

  function press(event: PointerEvent<HTMLAnchorElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    card.current?.setAttribute("data-pressed", "true");
    track(event);
  }

  function lift() {
    card.current?.removeAttribute("data-pressed");
  }

  function reset() {
    lift();
    const element = card.current;
    if (!element) return;
    for (const variable of [
      "--photo-rx", "--photo-ry", "--photo-shift-x", "--photo-shift-y",
      "--touch-x", "--touch-y",
    ]) element.style.removeProperty(variable);
  }

  return (
    <Link
      ref={card}
      href={href}
      className={styles.photo + (featured ? " " + styles.featured : "")}
      aria-label={alt ? `Explore ${alt}` : "Explore KULTURA collection"}
      draggable={false}
      onPointerMove={track}
      onPointerDown={press}
      onPointerUp={lift}
      onPointerCancel={reset}
      onPointerLeave={reset}
      onBlur={reset}
    >
      <span className={styles.depth} aria-hidden="true" />
      <span className={styles.surface}>
        <Image
          src={image}
          alt={alt}
          fill
          sizes={sizes}
          draggable={false}
          className={styles.image}
        />
        <span className={styles.gloss} aria-hidden="true" />
        <span className={styles.edge} aria-hidden="true" />
        <span className={styles.bottom}>
          <span className={styles.label}>{label}</span>
          <span className={styles.arrow} aria-hidden="true">↗</span>
        </span>
      </span>
    </Link>
  );
}
