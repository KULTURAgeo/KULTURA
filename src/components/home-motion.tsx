"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { FloatingHomeNav } from "./floating-home-nav";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const range = (value: number, from: number, to: number) =>
  clamp01((value - from) / Math.max(to - from, 0.0001));
const smooth = (value: number) => value * value * (3 - 2 * value);
const mix = (from: number, to: number, value: number) => from + (to - from) * value;

function progressFromRect(rect: DOMRect, viewportHeight: number) {
  const scrollable = Math.max(rect.height - viewportHeight, 1);
  return clamp01(-rect.top / scrollable);
}

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

    document.body.classList.add("kultura-motion-home");

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealNodes = Array.from(node.querySelectorAll<HTMLElement>("[data-reveal]"));

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).setAttribute("data-visible", "true");
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -5% 0px" },
    );
    revealNodes.forEach((item) => observer.observe(item));

    if (reduced) {
      revealNodes.forEach((item) => item.setAttribute("data-visible", "true"));
      return () => {
        observer.disconnect();
        document.body.classList.remove("kultura-motion-home");
      };
    }

    const hero = node.querySelector<HTMLElement>("[data-hero]");
    const heroCopy = node.querySelector<HTMLElement>("[data-hero-copy]");
    const demoTrack = node.querySelector<HTMLElement>("[data-demo-track]");
    const demoBackdrop = node.querySelector<HTMLElement>("[data-demo-backdrop]");
    const phone = node.querySelector<HTMLElement>("[data-phone]");
    const phoneSlides = Array.from(node.querySelectorAll<HTMLElement>("[data-phone-slide]"));
    const demoCaption = node.querySelector<HTMLElement>("[data-demo-caption]");
    const phoneTransition = node.querySelector<HTMLElement>("[data-phone-transition]");
    const transitionCta = node.querySelector<HTMLElement>("[data-transition-cta]");
    const transitionScene = node.querySelector<HTMLElement>("[data-transition-scene]");
    const transitionCenter = node.querySelector<HTMLElement>("[data-transition-center]");
    const transitionFloats = Array.from(node.querySelectorAll<HTMLElement>("[data-transition-float]"));

    if (demoTrack) {
      demoTrack.style.height = "365svh";
    }

    if (phoneTransition) {
      phoneTransition.style.width = "100vw";
      phoneTransition.style.height = "100svh";
      phoneTransition.style.top = "50%";
      phoneTransition.style.transform = "translate(-50%, -50%)";
      phoneTransition.style.willChange = "clip-path, opacity, transform";
    }

    let frame = 0;

    const render = () => {
      frame = 0;

      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const heroRect = hero?.getBoundingClientRect() ?? null;
      const demoRect = demoTrack?.getBoundingClientRect() ?? null;

      const heroP = heroRect
        ? clamp01(-heroRect.top / Math.max(viewportHeight * 0.72, 1))
        : 0;
      const demoP = demoRect ? progressFromRect(demoRect, viewportHeight) : 0;

      if (hero && heroCopy) {
        heroCopy.style.opacity = String(1 - smooth(range(heroP, 0.18, 0.92)));
        heroCopy.style.transform = `translate3d(0, ${mix(0, -54, smooth(heroP))}px, 0)`;
      }

      if (demoTrack && demoBackdrop && phone) {
        const p = demoP;

        const expand = smooth(range(p, 0.0, 0.12));
        const desktopInset = mix(24, 0, expand);
        const mobileInset = mix(12, 0, expand);
        const radius = mix(30, 0, expand);
        demoBackdrop.style.setProperty("--demo-inset", `${desktopInset}px`);
        demoBackdrop.style.setProperty("--demo-inset-mobile", `${mobileInset}px`);
        demoBackdrop.style.setProperty("--demo-radius", `${radius}px`);
        demoBackdrop.style.setProperty("--demo-bg-scale", String(mix(1.08, 1.015, expand)));

        const entry = smooth(range(p, 0.025, 0.13));
        const focusZoom = smooth(range(p, 0.64, 0.72));
        const handoff = smooth(range(p, 0.715, 0.815));
        const phoneFade = smooth(range(p, 0.77, 0.835));
        const entryOffset = mix(viewportHeight * 0.82, 0, entry);
        const focusLift = mix(0, -viewportHeight * 0.012, focusZoom);
        const handoffOffset = mix(0, -viewportHeight * 0.035, handoff);
        const entryScale = mix(0.73, 1, entry);
        const zoomScale = mix(1, 1.105, focusZoom);
        const handoffScale = mix(1, 0.992, handoff);
        const scale = entryScale * zoomScale * handoffScale;
        const opacity = entry * (1 - phoneFade * 0.98);

        phone.style.transform = `translate3d(-50%, calc(-50% + ${entryOffset + focusLift + handoffOffset}px), 0) scale(${scale})`;
        phone.style.opacity = String(opacity);

        const slidePosition = range(p, 0.15, 0.61) * Math.max(phoneSlides.length - 1, 0);
        phoneSlides.forEach((slide, index) => {
          const distance = index - slidePosition;
          const alpha = clamp01(1 - Math.abs(distance));
          slide.style.opacity = String(alpha);
          slide.style.transform = `translate3d(0, ${distance * 14}%, 0) scale(${mix(.975, 1, alpha)})`;
          slide.style.zIndex = String(10 + Math.round(alpha * 10));
        });

        if (phoneTransition) {
          const appear = smooth(range(p, 0.71, 0.735));
          const expandPanel = smooth(range(p, 0.735, 0.82));
          const sceneIn = smooth(range(p, 0.765, 0.84));

          const initialWidth = Math.max(300, Math.min(500, viewportWidth * 0.36));
          const initialHeight = Math.max(104, Math.min(148, viewportHeight * 0.19));
          const initialCenterY = viewportHeight * 0.71;
          const initialSide = Math.max((viewportWidth - initialWidth) / 2, 0);
          const initialTop = Math.max(initialCenterY - initialHeight / 2, 0);
          const initialBottom = Math.max(viewportHeight - (initialCenterY + initialHeight / 2), 0);
          const side = mix(initialSide, 0, expandPanel);
          const topInset = mix(initialTop, 0, expandPanel);
          const bottomInset = mix(initialBottom, 0, expandPanel);
          const borderRadius = mix(24, 0, expandPanel);

          phoneTransition.style.opacity = String(appear);
          phoneTransition.style.clipPath = `inset(${topInset}px ${side}px ${bottomInset}px ${side}px round ${borderRadius}px)`;

          if (transitionCta) {
            const ctaOut = 1 - smooth(range(p, 0.755, 0.79));
            transitionCta.style.opacity = String(ctaOut);
            transitionCta.style.transform = `translate(-50%, -50%) scale(${mix(1, .94, 1 - ctaOut)})`;
          }

          if (transitionScene) {
            const sceneTravel = smooth(range(p, 0.765, 0.995));
            transitionScene.style.opacity = String(sceneIn);
            transitionScene.style.transform = `translate3d(0, ${mix(10, -10, sceneTravel)}px, 0) scale(${mix(.992, 1, sceneTravel)})`;
            transitionScene.style.willChange = "transform, opacity";
          }

          if (transitionCenter) {
            const centerGrow = smooth(range(p, 0.765, 0.955));
            transitionCenter.style.transform = `translate(-50%, -50%) scale(${mix(.46, 1, centerGrow)})`;
          }

          transitionFloats.forEach((card, index) => {
            const start = 0.78 + index * 0.012;
            const end = 0.95 + index * 0.012;
            const local = smooth(range(p, start, Math.min(end, 0.995)));

            const fromX = index % 2 === 0 ? viewportWidth * 0.34 : -viewportWidth * 0.34;
            const fromY = index < 2 ? viewportHeight * 0.29 : -viewportHeight * 0.29;
            const x = mix(fromX, 0, local);
            const y = mix(fromY, 0, local);
            const cardScale = mix(0.42, 1, local);

            card.style.opacity = String(local);
            card.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${cardScale})`;
            card.style.transformOrigin = "center center";
          });

          const backdropOut = smooth(range(p, 0.74, 0.83));
          demoBackdrop.style.opacity = String(1 - backdropOut * 0.95);
        } else {
          demoBackdrop.style.opacity = "1";
        }

        if (demoCaption) {
          const enterCaption = smooth(range(p, 0.10, 0.18));
          const leaveCaption = 1 - smooth(range(p, 0.58, 0.64));
          demoCaption.style.opacity = String(enterCaption * leaveCaption);
        }
      }
    };

    const requestRender = () => {
      if (!frame) frame = requestAnimationFrame(render);
    };

    render();
    window.addEventListener("scroll", requestRender, { passive: true });
    window.addEventListener("resize", requestRender);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestRender);
      window.removeEventListener("resize", requestRender);
      observer.disconnect();
      document.body.classList.remove("kultura-motion-home");
    };
  }, []);

  return (
    <div ref={root} className={className}>
      <FloatingHomeNav />
      {children}
    </div>
  );
}
