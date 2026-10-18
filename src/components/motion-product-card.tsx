"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { useMotionPreview } from "./motion-preview-provider";

/**
 * Motion owns the product card's entrance and gesture transform.
 * The legacy IntersectionObserver intentionally ignores these cards,
 * so the two animation engines never fight over the same transform.
 */
export function MotionProductCard({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const { enabled, replay } = useMotionPreview();
  const active = enabled && !reduced;
  return (
    <motion.article
      key={replay}
      className="product-card"
      data-motion-managed
      layout={active ? "position" : false}
      initial={active ? { opacity: 0, y: 60, scale: 0.95 } : false}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.13, margin: "0px 0px -24px 0px" }}
      whileHover={active ? { y: -10, scale: 1.025 } : undefined}
      whileTap={active ? { scale: 0.97 } : undefined}
      exit={!active ? undefined : { opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      transition={
        !active
          ? { duration: 0 }
          : { type: "spring", stiffness: 165, damping: 24, mass: 0.85 }
      }
    >
      {children}
    </motion.article>
  );
}
