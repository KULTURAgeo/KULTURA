"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function HomeMotion({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = root.current;
    if (!node) return;

    const revealNodes = Array.from(
      node.querySelectorAll<HTMLElement>("[data-reveal]"),
    );
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      revealNodes.forEach((item) => item.setAttribute("data-visible", "true"));
      return;
    }

    const revealTransitions = revealNodes.map((item) => item.style.transition);
    const marquee = node.querySelector<HTMLElement>("[data-home-marquee]");
    const marqueeAnimation = marquee?.style.animation ?? "";
    let cancelled = false;
    let cleanup = () => {};

    void import("animejs").then(
      ({ animate, createAnimatable, createScope, onScroll, stagger }) => {
        if (cancelled) return;
        let pointerHandler: ((event: PointerEvent) => void) | null = null;

        const scope = createScope({ root: node }).add(() => {
          revealNodes.forEach((item, index) => {
            item.style.transition = "none";
            animate(item, {
              opacity: [0, 1],
              y: [34, 0],
              duration: 760,
              delay: Math.min((index % 3) * 70, 140),
              ease: "out(4)",
              autoplay: onScroll({
                target: item,
                enter: "top bottom",
                leave: "bottom top",
                repeat: false,
              }),
            });
          });

          const hero = node.querySelector<HTMLElement>("[data-home-hero]");
          const heroMedia = node.querySelector<HTMLElement>("[data-home-media]");
          if (hero && heroMedia) {
            animate(heroMedia, {
              y: [0, 110],
              scale: [1, 1.072],
              ease: "linear",
              autoplay: onScroll({
                target: hero,
                enter: "top top",
                leave: "bottom top",
                sync: true,
              }),
            });
          }

          const intro = Array.from(
            node.querySelectorAll<HTMLElement>("[data-home-intro]"),
          );
          if (intro.length) {
            animate(intro, {
              opacity: [0, 1],
              y: [24, 0],
              duration: 820,
              delay: stagger(95, { start: 80 }),
              ease: "out(4)",
            });
          }

          if (marquee) {
            marquee.style.animation = "none";
            animate(marquee, {
              x: ["0%", "-50%"],
              duration: 24000,
              ease: "linear",
              loop: true,
            });
          }

          const orb = node.querySelector<HTMLElement>("[data-home-orb]");
          const ring = node.querySelector<HTMLElement>("[data-home-ring]");
          const orbMotion = orb
            ? createAnimatable(orb, {
                x: 360,
                y: 360,
                rotate: 420,
                ease: "out(3)",
              })
            : null;
          const ringMotion = ring
            ? createAnimatable(ring, {
                x: 520,
                y: 520,
                ease: "out(3)",
              })
            : null;

          if (orbMotion || ringMotion) {
            pointerHandler = (event: PointerEvent) => {
              const rect = node.getBoundingClientRect();
              const x =
                ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
              const y =
                ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
              orbMotion?.x(x * 10).y(y * 10).rotate(x * 4);
              ringMotion?.x(x * -10).y(y * -10);
            };
            node.addEventListener("pointermove", pointerHandler, { passive: true });
          }
        });

        cleanup = () => {
          if (pointerHandler)
            node.removeEventListener("pointermove", pointerHandler);
          revealNodes.forEach((item, index) => {
            item.style.transition = revealTransitions[index] ?? "";
          });
          if (marquee) marquee.style.animation = marqueeAnimation;
          scope.revert();
        };
      },
    );

    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
