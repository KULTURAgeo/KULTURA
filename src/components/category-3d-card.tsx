"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { LocalizedCategoryName } from "./localized-category-name";
import { useMotionPreview } from "./motion-preview-provider";
import styles from "./category-3d-card.module.css";

/**
 * A lightweight layered 3D editorial scene. The swatches change lighting,
 * never product color: products need real color-specific images/3D assets.
 */
const LIGHTS = [
  { name: "Silver", rgb: "203, 214, 226", hex: "#cbd6e2" },
  { name: "Acid", rgb: "201, 255, 75", hex: "#c9ff4b" },
  { name: "Cobalt", rgb: "76, 141, 255", hex: "#4c8dff" },
  { name: "Rose", rgb: "255, 119, 151", hex: "#ff7797" },
] as const;

export function Category3DCard({
  slug, name, image, alt, index, className, shopLabel,
}: {
  slug: string;
  name: string;
  image: string;
  alt: string;
  index: number;
  className: string;
  shopLabel: string;
}) {
  const [light, setLight] = useState(0);
  const sceneRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { enabled, replay } = useMotionPreview();
  const canAnimate = enabled && !reduced;
  const lightStyle = { "--light-rgb": LIGHTS[light].rgb } as CSSProperties;

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    if (!canAnimate || (event.pointerType !== "mouse" && event.pointerType !== "pen")) return;
    const scene = sceneRef.current;
    if (!scene) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5;
    const y = (event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5;
    scene.style.setProperty("--tilt-x", (-y * 9).toFixed(2) + "deg");
    scene.style.setProperty("--tilt-y", (x * 11).toFixed(2) + "deg");
    scene.style.setProperty("--pointer-x", ((x + 0.5) * 100).toFixed(1) + "%");
    scene.style.setProperty("--pointer-y", ((y + 0.5) * 100).toFixed(1) + "%");
  }

  function resetPointer() {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.style.removeProperty("--tilt-x");
    scene.style.removeProperty("--tilt-y");
    scene.style.removeProperty("--pointer-x");
    scene.style.removeProperty("--pointer-y");
  }

  return (
    <motion.article
      key={slug + "-" + enabled + "-" + replay}
      className={className + " " + styles.card}
      data-gallery-card=""
      data-motion-managed=""
      style={lightStyle}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      initial={canAnimate ? { opacity: 0, y: 72, scale: 0.93, rotate: index % 2 ? 1.7 : -1.7 } : false}
      whileInView={canAnimate ? { opacity: 1, y: 0, scale: 1, rotate: 0 } : undefined}
      viewport={{ once: true, amount: 0.12, margin: "0px 0px -30px 0px" }}
      whileHover={canAnimate ? { y: -8, scale: 1.012 } : undefined}
      transition={canAnimate ? { type: "spring", stiffness: 155, damping: 24, mass: 0.9, delay: (index % 4) * 0.09 } : { duration: 0 }}
    >
      <div className={styles.perspective} aria-hidden="true">
        <div className={styles.scene} ref={sceneRef}>
          <div className={styles.floor} />
          <div className={styles.photo}>
            <Image src={image} alt="" fill sizes="(max-width: 720px) 92vw, (max-width: 980px) 46vw, 25vw" />
          </div>
          <div className={styles.light} />
          <div className={styles.shade} />
          <div className={styles.frame} />
        </div>
      </div>

      <span className={styles.index} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>

      <Link href={"/shop/" + slug} className={styles.categoryLink} aria-label={shopLabel + ": " + name}>
        <span className={styles.copy}>
          <strong><LocalizedCategoryName name={name} slug={slug} /></strong>
          <span>{shopLabel}</span>
        </span>
        <span className={styles.srOnly}>{alt}</span>
      </Link>

      <div className={styles.controls} role="group" aria-label={name + " scene lighting"}>
        <span className={styles.controlLabel}>LIGHT</span>
        <div className={styles.swatches}>
          {LIGHTS.map((item, colorIndex) => (
            <button
              key={item.name}
              type="button"
              className={styles.swatch}
              style={{ "--swatch": item.hex } as CSSProperties}
              aria-label={item.name + " lighting"}
              aria-pressed={light === colorIndex}
              title={item.name + " lighting"}
              onClick={() => setLight(colorIndex)}
            />
          ))}
        </div>
      </div>
    </motion.article>
  );
}
