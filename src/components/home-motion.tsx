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

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealNodes = Array.from(node.querySelectorAll<HTMLElement>("[data-reveal]"));

    if (reduced) {
      revealNodes.forEach((item) => item.setAttribute("data-visible", "true"));
      return;
    }

    let cancelled = false;
    let cleanup = () => {};

    void import("animejs").then(({ animate, createScope, onScroll, stagger }) => {
      if (cancelled) return;

      const scope = createScope({ root: node }).add(() => {
        revealNodes.forEach((item) => {
          item.style.transition = "none";
          animate(item, {
            opacity: [0, 1],
            y: [36, 0],
            duration: 760,
            ease: "out(4)",
            autoplay: onScroll({
              target: item,
              enter: "top 88%",
              leave: "bottom top",
              repeat: false,
            }),
          });
        });

        const introScene = node.querySelector<HTMLElement>("[data-intro-scene]");
        const introTitle = node.querySelector<HTMLElement>("[data-intro-title]");
        const introCopy = node.querySelector<HTMLElement>("[data-intro-copy]");
        if (introScene && introTitle) {
          animate(introTitle, {
            scale: [1, 0.86],
            y: [0, -82],
            letterSpacing: ["-0.075em", "-0.055em"],
            ease: "linear",
            autoplay: onScroll({
              target: introScene,
              enter: "top top",
              leave: "bottom top",
              sync: true,
            }),
          });
          if (introCopy) {
            animate(introCopy, {
              opacity: [1, 0.15],
              y: [0, -44],
              ease: "linear",
              autoplay: onScroll({
                target: introScene,
                enter: "35% top",
                leave: "bottom top",
                sync: true,
              }),
            });
          }
        }

        const studioScene = node.querySelector<HTMLElement>("[data-studio-scene]");
        const studioBackdrop = node.querySelector<HTMLElement>("[data-studio-backdrop]");
        const generator = node.querySelector<HTMLElement>("[data-generator-card]");
        const studioCaption = node.querySelector<HTMLElement>("[data-studio-caption]");
        const slideKnob = node.querySelector<HTMLElement>("[data-slide-knob]");
        if (studioScene) {
          if (studioBackdrop) {
            animate(studioBackdrop, {
              scale: [1.12, 1.01],
              y: [70, -24],
              ease: "linear",
              autoplay: onScroll({ target: studioScene, enter: "top top", leave: "bottom top", sync: true }),
            });
          }
          if (generator) {
            animate(generator, {
              y: [130, -26],
              scale: [0.76, 1.02],
              rotate: [-7, 0],
              opacity: [0.15, 1],
              ease: "linear",
              autoplay: onScroll({ target: studioScene, enter: "top top", leave: "75% top", sync: true }),
            });
          }
          if (studioCaption) {
            animate(studioCaption, {
              opacity: [0, 1],
              x: [-55, 0],
              ease: "linear",
              autoplay: onScroll({ target: studioScene, enter: "20% top", leave: "65% top", sync: true }),
            });
          }
          if (slideKnob) {
            animate(slideKnob, {
              x: [0, 164],
              rotate: [0, 360],
              ease: "linear",
              autoplay: onScroll({ target: studioScene, enter: "35% top", leave: "78% top", sync: true }),
            });
          }
        }

        const orbitScene = node.querySelector<HTMLElement>("[data-orbit-scene]");
        const orbitHero = node.querySelector<HTMLElement>("[data-orbit-hero]");
        const orbitCopy = node.querySelector<HTMLElement>("[data-orbit-copy]");
        if (orbitScene) {
          if (orbitHero) {
            animate(orbitHero, {
              scale: [0.68, 1.03],
              rotate: [-5, 0],
              y: [110, -18],
              ease: "linear",
              autoplay: onScroll({ target: orbitScene, enter: "top top", leave: "78% top", sync: true }),
            });
          }
          if (orbitCopy) {
            animate(orbitCopy, {
              opacity: [0, 1, 0.2],
              y: [42, 0, -52],
              ease: "linear",
              autoplay: onScroll({ target: orbitScene, enter: "8% top", leave: "92% top", sync: true }),
            });
          }

          const floatCards = Array.from(node.querySelectorAll<HTMLElement>("[data-float-card]"));
          floatCards.forEach((card, index) => {
            const x = Number(card.dataset.driftX ?? 0);
            const y = Number(card.dataset.driftY ?? 0);
            const r = Number(card.dataset.driftR ?? 0);
            animate(card, {
              opacity: [0, 1],
              scale: [0.72, 1],
              x: [-x * 0.45, x],
              y: [-y * 0.4, y],
              rotate: [-r * 0.6, r],
              delay: index * 25,
              ease: "linear",
              autoplay: onScroll({ target: orbitScene, enter: "10% top", leave: "82% top", sync: true }),
            });
          });
        }

        const categoryCards = Array.from(node.querySelectorAll<HTMLElement>("[data-category-card]"));
        if (categoryCards.length) {
          animate(categoryCards, {
            opacity: [0, 1],
            y: [58, 0],
            scale: [0.97, 1],
            delay: stagger(70),
            duration: 820,
            ease: "out(4)",
            autoplay: onScroll({
              target: categoryCards[0],
              enter: "top 88%",
              leave: "bottom top",
              repeat: false,
            }),
          });
        }
      });

      cleanup = () => scope.revert();
    });

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
