"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { FloatingHomeNav } from "./floating-home-nav";

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
        const introCopy = node.querySelector<HTMLElement>("[data-intro-copy]");
        const deviceBackdrop = node.querySelector<HTMLElement>("[data-intro-device-backdrop]");
        const devicePhone = node.querySelector<HTMLElement>("[data-intro-device-phone]");
        const screenOne = node.querySelector<HTMLElement>('[data-device-screen="1"]');
        const screenTwo = node.querySelector<HTMLElement>('[data-device-screen="2"]');
        const screenThree = node.querySelector<HTMLElement>('[data-device-screen="3"]');

        if (introScene) {
          if (introCopy) {
            animate(introCopy, {
              opacity: [1, 0],
              y: [0, -150],
              scale: [1, 0.94],
              ease: "linear",
              autoplay: onScroll({
                target: introScene,
                enter: "top top",
                leave: "28% top",
                sync: true,
              }),
            });
          }

          if (deviceBackdrop) {
            animate(deviceBackdrop, {
              left: [32, 0],
              right: [32, 0],
              height: ["22svh", "100svh"],
              borderRadius: ["28px 28px 0px 0px", "0px"],
              scale: [0.985, 1],
              ease: "linear",
              autoplay: onScroll({
                target: introScene,
                enter: "top top",
                leave: "38% top",
                sync: true,
              }),
            });
          }

          if (devicePhone) {
            animate(devicePhone, {
              y: ["47vh", "0vh"],
              scale: [0.76, 1],
              rotate: [-2.5, 0],
              ease: "linear",
              autoplay: onScroll({
                target: introScene,
                enter: "top top",
                leave: "38% top",
                sync: true,
              }),
            });

            animate(devicePhone, {
              y: ["0vh", "-7vh"],
              scale: [1, 0.9],
              opacity: [1, 0.15],
              ease: "linear",
              autoplay: onScroll({
                target: introScene,
                enter: "84% top",
                leave: "bottom top",
                sync: true,
              }),
            });
          }

          if (screenOne) {
            animate(screenOne, {
              opacity: [1, 0],
              y: [0, -70],
              ease: "linear",
              autoplay: onScroll({
                target: introScene,
                enter: "38% top",
                leave: "54% top",
                sync: true,
              }),
            });
          }

          if (screenTwo) {
            animate(screenTwo, {
              opacity: [0, 1, 1, 0],
              y: [70, 0, 0, -70],
              ease: "linear",
              autoplay: onScroll({
                target: introScene,
                enter: "43% top",
                leave: "72% top",
                sync: true,
              }),
            });
          }

          if (screenThree) {
            animate(screenThree, {
              opacity: [0, 1],
              y: [70, 0],
              ease: "linear",
              autoplay: onScroll({
                target: introScene,
                enter: "67% top",
                leave: "83% top",
                sync: true,
              }),
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
      <FloatingHomeNav />
      {children}
    </div>
  );
}
