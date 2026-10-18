"use client";

import { useEffect, useRef } from "react";

/**
 * Production cinematic scrolling.
 * Lenis loads lazily for desktop mouse/trackpad users only.
 * Touch devices, reduced-motion users, open dialogs and nested inputs
 * retain native scrolling.
 */
export function PremiumScroll() {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.dataset.motionMode = "cinematic";

    const desktop = window.matchMedia(
      "(min-width: 800px) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    let controller: import("lenis").default | null = null;
    let alive = true;
    let generation = 0;

    const setUp = () => {
      const version = ++generation;
      controller?.destroy();
      controller = null;
      if (!desktop.matches) return;
      void import("lenis").then(({ default: Lenis }) => {
        if (!alive || version !== generation) return;
        controller = new Lenis({
          autoRaf: true,
          smoothWheel: true,
          lerp: 0.072,
          wheelMultiplier: 0.92,
          syncTouch: false,
          prevent: (node) => Boolean(node.closest("dialog, [data-lenis-prevent], [role='dialog'], textarea, select")),
        });
      }).catch(() => {
        // Native browser scrolling is a fully functional fallback.
      });
    };
    setUp();
    desktop.addEventListener("change", setUp);
    return () => {
      alive = false;
      generation++;
      desktop.removeEventListener("change", setUp);
      controller?.destroy();
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const percent = Math.max(0, Math.min(window.scrollY / max, 1));
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${percent})`;
    };
    const request = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
    };
  }, []);

  return (
    <div className="k-scroll-progress" aria-hidden="true"><div ref={progressRef} /></div>
  );
}
