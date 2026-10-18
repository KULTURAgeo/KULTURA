"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useMotionPreview } from "./motion-preview-provider";
import type { ReactNode } from "react";

const MotionLink = motion.create(Link);

function motionEnabled(enabled: boolean, reduced: boolean | null) {
  return enabled && !reduced;
}

/** The homepage hero always exists, even when the store catalog is empty. */
export function MotionHeroCopy({
  className, leadClassName, socialsClassName, title, lead, instagramUrl, facebookUrl,
}: {
  className: string;
  leadClassName: string;
  socialsClassName: string;
  title: string;
  lead: string;
  instagramUrl: string;
  facebookUrl?: string;
}) {
  const { enabled, replay } = useMotionPreview();
  const reduced = useReducedMotion();
  const active = motionEnabled(enabled, reduced);
  const move = { type: "spring" as const, stiffness: 125, damping: 20, mass: 1 };
  return (
    <div className={className} data-hero-copy>
      <motion.h1
        key={`title-${enabled}-${replay}`}
        initial={active ? { opacity: 0, y: 100, rotateX: -16, filter: "blur(8px)" } : false}
        animate={{ opacity: 1, y: 0, rotateX: 0, filter: "blur(0px)" }}
        transition={active ? { ...move, delay: 0.08 } : { duration: 0 }}
      >{title}</motion.h1>
      <motion.p
        key={`lead-${enabled}-${replay}`}
        className={leadClassName}
        initial={active ? { opacity: 0, y: 45 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={active ? { ...move, delay: 0.29 } : { duration: 0 }}
      >{lead}</motion.p>
      <motion.div
        key={`social-${enabled}-${replay}`}
        className={socialsClassName}
        initial={active ? { opacity: 0, y: 25 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={active ? { ...move, delay: 0.48 } : { duration: 0 }}
      >
        <a href={instagramUrl} target="_blank" rel="noopener noreferrer">INSTAGRAM ↗</a>
        <a href={facebookUrl} target={facebookUrl ? "_blank" : undefined}
          rel={facebookUrl ? "noopener noreferrer" : undefined} aria-disabled={!facebookUrl}>FACEBOOK ↗</a>
      </motion.div>
    </div>
  );
}

/** Large editorial hero image slides fully into the page, independent of product data. */
export function MotionHeroPeek({
  className, children,
}: { className: string; children: ReactNode }) {
  const { enabled, replay } = useMotionPreview();
  const reduced = useReducedMotion();
  const active = motionEnabled(enabled, reduced);
  return (
    <motion.div
      key={`peek-${enabled}-${replay}`}
      aria-hidden="true"
      className={className}
      initial={active ? { opacity: 0.45, y: 165, scale: 0.88 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={active ? { scale: 1.012 } : undefined}
      transition={active ? { type: "spring", stiffness: 110, damping: 22, mass: 1.2, delay: 0.18 } : { duration: 0 }}
    >{children}</motion.div>
  );
}

/** Next Link is preserved, so navigation/prefetch and accessibility still work. */
export function MotionRevealLink({
  href, className, index, gallery = false, children,
}: {
  href: string; className?: string; index: number; gallery?: boolean; children: ReactNode;
}) {
  const { enabled, replay } = useMotionPreview();
  const reduced = useReducedMotion();
  const active = motionEnabled(enabled, reduced);
  return (
    <MotionLink
      key={`${href}-${replay}-${enabled}`}
      href={href}
      className={className}
      data-gallery-card={gallery ? "" : undefined}
      data-motion-managed
      initial={active ? { opacity: 0, y: 76, scale: 0.91, rotate: index % 2 === 0 ? -2 : 2 } : false}
      whileInView={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      viewport={{ once: true, amount: 0.13, margin: "0px 0px -30px 0px" }}
      whileHover={active ? { y: -10, scale: 1.015 } : undefined}
      whileTap={active ? { scale: 0.98 } : undefined}
      transition={active ? { type: "spring", stiffness: 155, damping: 23, mass: 0.9, delay: (index % 4) * 0.1 } : { duration: 0 }}
    >{children}</MotionLink>
  );
}
