"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Motion owns the product card's entrance and gesture transform.
 * The legacy IntersectionObserver intentionally ignores these cards,
 * so the two animation engines never fight over the same transform.
 */
export function MotionProductCard({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.article
      className="product-card"
      data-motion-managed
      layout={reduced ? false : "position"}
      initial={reduced ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.13, margin: "0px 0px -24px 0px" }}
      whileHover={reduced ? undefined : { y: -7, scale: 1.012 }}
      whileTap={reduced ? undefined : { scale: 0.988 }}
      exit={reduced ? undefined : { opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      transition={
        reduced
          ? { duration: 0 }
          : { type: "spring", stiffness: 165, damping: 24, mass: 0.85 }
      }
    >
      {children}
    </motion.article>
  );
}
