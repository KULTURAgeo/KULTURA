"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function HomeMotion({ children, className = "" }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = root.current;
    if (!node) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealNodes = Array.from(node.querySelectorAll<HTMLElement>("[data-reveal]"));

    if (reducedMotion) {
      revealNodes.forEach((item) => item.setAttribute("data-visible", "true"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).setAttribute("data-visible", "true");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    revealNodes.forEach((item) => observer.observe(item));

    let frame = 0;
    const updateScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        node.style.setProperty("--home-parallax", `${Math.min(y * 0.11, 110)}px`);
        node.style.setProperty("--home-scale", String(1 + Math.min(y, 900) * 0.00008));
      });
    };

    const updatePointer = (event: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
      const y = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
      node.style.setProperty("--pointer-x", x.toFixed(3));
      node.style.setProperty("--pointer-y", y.toFixed(3));
    };

    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    node.addEventListener("pointermove", updatePointer, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", updateScroll);
      node.removeEventListener("pointermove", updatePointer);
    };
  }, []);

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
