"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useIsPresent, useReducedMotion, type Variants } from "motion/react";
import { useState, type ReactNode } from "react";
import type { ProductImage } from "@/lib/catalog";
import { useLanguage } from "./language-provider";
import styles from "./product-card-preview.module.css";

type Direction = -1 | 1;
type Slide = { index: number; direction: Direction };

const imageOptions = {
  fill: true,
  quality: 90,
  sizes: "(max-width: 360px) calc(100vw - 40px), (max-width: 767px) calc(50vw - 26px), (max-width: 1375px) 32vw, 440px",
};

const slideMotion: Variants = {
  enter: (direction: Direction) => ({ x: direction === 1 ? "100%" : "-100%" }),
  center: { x: "0%" },
  exit: (direction: Direction) => ({ x: direction === 1 ? "-100%" : "100%" }),
};

function CardPhoto({ photo, direction, animate }: {
  photo: ProductImage;
  direction: Direction;
  animate: boolean;
}) {
  const present = useIsPresent();
  return (
    <motion.div className={styles.slide} custom={direction} variants={slideMotion}
      initial={animate ? "enter" : false} animate="center" exit={animate ? "exit" : undefined}
      transition={{ duration: animate ? .42 : 0, ease: [.22, 1, .36, 1] }}
      aria-hidden={present ? undefined : true}>
      <Image {...imageOptions} src={photo.src} alt={photo.alt} className={styles.photo}
        data-card-photo-outgoing={present ? undefined : ""} />
    </motion.div>
  );
}

export function ProductCardPreview({ href, name, photos, badges, children }: {
  href: string;
  name: string;
  photos: readonly ProductImage[];
  badges: ReactNode;
  children: ReactNode;
}) {
  const { locale } = useLanguage();
  const reducedMotion = useReducedMotion();
  const [gallery, setGallery] = useState<{ active: Slide; pending: Slide | null }>({
    active: { index: 0, direction: 1 },
    pending: null,
  });
  const count = photos.length;
  const current = gallery.active.index < count ? gallery.active.index : 0;
  const photo = photos[current];
  const pending = gallery.pending;
  const pendingPhoto = pending ? photos[pending.index] : undefined;
  const isKa = locale === "ka";

  function changePhoto(direction: Direction) {
    const index = (current + direction + count) % count;
    setGallery((previous) => previous.pending?.index === index && previous.pending.direction === direction
      ? previous
      : { ...previous, pending: { index, direction } });
  }

  function finishLoading(request: Slide, loaded: boolean) {
    setGallery((previous) => previous.pending !== request
      ? previous
      : { active: loaded ? request : previous.active, pending: null });
  }

  return (
    <div className={styles.card}>
      <Link className={styles.link} href={href} prefetch={false}>
        <div className="product-image">
          <AnimatePresence initial={false} custom={gallery.active.direction}>
            <CardPhoto key={current} photo={photo} direction={gallery.active.direction}
              animate={count > 1 && !reducedMotion} />
          </AnimatePresence>
          <div className="product-badge">{badges}</div>
          <span className="product-arrow" aria-hidden="true">↗</span>
        </div>
        {children}
      </Link>
      {pending && pendingPhoto && (
        <div className={styles.preload} aria-hidden="true">
          <Image key={pending.index} {...imageOptions} src={pendingPhoto.src} alt="" loading="eager"
            onLoad={() => finishLoading(pending, true)} onError={() => finishLoading(pending, false)} />
        </div>
      )}
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
          <span className="sr-only" role="status">
            {isKa ? `ფოტო ${current + 1}, სულ ${count}` : `Photo ${current + 1} of ${count}`}
          </span>
        </div>
      )}
    </div>
  );
}
