"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { FloatingHomeNav } from "./floating-home-nav";

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const range = (value: number, from: number, to: number) =>
  clamp01((value - from) / Math.max(to - from, 0.0001));
const smooth = (value: number) => value * value * (3 - 2 * value);
const mix = (from: number, to: number, value: number) => from + (to - from) * value;

function progressFor(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const scrollable = Math.max(rect.height - window.innerHeight, 1);
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

    const orbitTrack = node.querySelector<HTMLElement>("[data-orbit-track]");
    const orbitHeading = node.querySelector<HTMLElement>("[data-orbit-heading]");
    const orbitCenter = node.querySelector<HTMLElement>("[data-orbit-center]");
    const floats = Array.from(node.querySelectorAll<HTMLElement>("[data-float]"));

    const floatStarts = [
      [-120, -90, -9],
      [130, -70, 8],
      [-140, 120, 7],
      [135, 115, -8],
      [-55, -105, 10],
      [70, 120, -9],
    ];

    let frame = 0;

    const render = () => {
      frame = 0;

      if (hero && heroCopy) {
        const rect = hero.getBoundingClientRect();
        const p = clamp01(-rect.top / Math.max(window.innerHeight * 0.72, 1));
        heroCopy.style.opacity = String(1 - smooth(range(p, 0.18, 0.92)));
        heroCopy.style.transform = `translate3d(0, ${mix(0, -54, smooth(p))}px, 0)`;
      }

      if (demoTrack && demoBackdrop && phone) {
        const p = progressFor(demoTrack);

        const expand = smooth(range(p, 0.0, 0.18));
        const desktopInset = mix(24, 0, expand);
        const mobileInset = mix(12, 0, expand);
        const radius = mix(30, 0, expand);
        demoBackdrop.style.setProperty("--demo-inset", `${desktopInset}px`);
        demoBackdrop.style.setProperty("--demo-inset-mobile", `${mobileInset}px`);
        demoBackdrop.style.setProperty("--demo-radius", `${radius}px`);
        demoBackdrop.style.setProperty("--demo-bg-scale", String(mix(1.08, 1.015, expand)));

        const entry = smooth(range(p, 0.05, 0.25));
        const focusZoom = smooth(range(p, 0.40, 0.58));
        const handoff = smooth(range(p, 0.58, 0.72));
        const phoneFade = smooth(range(p, 0.64, 0.76));
        const entryOffset = mix(window.innerHeight * 0.82, 0, entry);
        const zoomLift = mix(0, -window.innerHeight * 0.04, focusZoom);
        const handoffOffset = mix(0, -window.innerHeight * 0.04, handoff);
        const entryScale = mix(0.73, 1, entry);
        const focusScale = mix(1, 1.14, focusZoom);
        const handoffScale = mix(1, 0.98, handoff);
        const scale = entryScale * focusScale * handoffScale;
        const opacity = entry * (1 - phoneFade * 0.92);

        phone.style.transform = `translate3d(-50%, calc(-50% + ${entryOffset + zoomLift + handoffOffset}px), 0) scale(${scale})`;
        phone.style.opacity = String(opacity);

        const slidePosition = range(p, 0.30, 0.54) * Math.max(phoneSlides.length - 1, 0);
        phoneSlides.forEach((slide, index) => {
          const distance = index - slidePosition;
          const alpha = clamp01(1 - Math.abs(distance));
          slide.style.opacity = String(alpha);
          slide.style.transform = `translate3d(0, ${distance * 18}%, 0) scale(${mix(.965, 1, alpha)})`;
          slide.style.zIndex = String(10 + Math.round(alpha * 10));
        });

        if (phoneTransition) {
          const appear = smooth(range(p, 0.56, 0.61));
          const expandPanel = smooth(range(p, 0.60, 0.75));
          const sceneIn = smooth(range(p, 0.66, 0.78));

          const phoneRect = phone.getBoundingClientRect();
          const stickyRect = demoTrack.getBoundingClientRect();
          const stickyTop = Math.max(0, -stickyRect.top);
          const initialTop = Math.min(
            window.innerHeight * 0.72,
            Math.max(window.innerHeight * 0.58, phoneRect.bottom - stickyTop - 20),
          );

          const initialWidth = Math.max(310, Math.min(560, phoneRect.width * 1.55));
          const initialHeight = Math.max(104, Math.min(164, phoneRect.height * 0.22));
          const width = mix(initialWidth, window.innerWidth, expandPanel);
          const height = mix(initialHeight, window.innerHeight, expandPanel);
          const top = mix(initialTop, window.innerHeight * 0.5, expandPanel);
          const borderRadius = mix(24, 0, expandPanel);

          phoneTransition.style.opacity = String(appear);
          phoneTransition.style.width = `${width}px`;
          phoneTransition.style.height = `${height}px`;
          phoneTransition.style.top = `${top}px`;
          phoneTransition.style.borderRadius = `${borderRadius}px`;
          phoneTransition.style.transform = `translate(-50%, -50%) scale(${mix(.92, 1, appear)})`;

          if (transitionCta) {
            const ctaOut = 1 - smooth(range(p, 0.63, 0.70));
            transitionCta.style.opacity = String(ctaOut);
            transitionCta.style.transform = `translate(-50%, -50%) scale(${mix(1, .92, 1 - ctaOut)})`;
          }

          if (transitionScene) {
            transitionScene.style.opacity = String(sceneIn);
          }

          if (transitionCenter) {
            transitionCenter.style.transform = `translate(-50%, -50%) scale(${mix(.80, 1, sceneIn)})`;
          }

          transitionFloats.forEach((card, index) => {
            const local = smooth(range(p, 0.67 + index * 0.01, 0.76 + index * 0.01));
            card.style.opacity = String(local);
            card.style.transform = `scale(${mix(.74, 1, local)})`;
          });

          const backdropOut = smooth(range(p, 0.60, 0.74));
          demoBackdrop.style.opacity = String(1 - backdropOut * 0.9);
          demoBackdrop.style.filter = `brightness(${mix(1, .22, backdropOut)})`;
        } else {
          demoBackdrop.style.opacity = "1";
          demoBackdrop.style.filter = "none";
        }

        if (demoCaption) {
          const enterCaption = smooth(range(p, 0.18, 0.3));
          const leaveCaption = 1 - smooth(range(p, 0.44, 0.56));
          demoCaption.style.opacity = String(enterCaption * leaveCaption);
        }
      }

      if (orbitTrack && orbitCenter && orbitHeading) {
        const p = progressFor(orbitTrack);
        const headingIn = smooth(range(p, -0.05, 0.05));
        const headingOut = 1 - smooth(range(p, 0.72, 0.92));
        orbitHeading.style.opacity = String(headingIn * headingOut);
        orbitHeading.style.transform = `translate3d(0, ${mix(14, -18, smooth(range(p, 0, .86)))}px, 0)`;

        const centerIn = smooth(range(p, -0.06, 0.04));
        const centerOut = 1 - smooth(range(p, 0.82, 1));
        orbitCenter.style.opacity = String(centerIn * centerOut);
        orbitCenter.style.transform = `translate(-50%, -50%) scale(${mix(.94, 1, centerIn) * mix(1, .9, 1 - centerOut)})`;

        floats.forEach((card, index) => {
          const start = -0.07 + index * 0.012;
          const inP = smooth(range(p, start, start + 0.12));
          const outP = smooth(range(p, 0.82, 1));
          const [sx, sy, sr] = floatStarts[index] ?? [0, 0, 0];
          const driftX = sx * (1 - inP) + sx * -0.12 * inP;
          const driftY = sy * (1 - inP) + sy * -0.08 * inP;
          const rotate = sr * (1 - inP) + sr * -0.2 * inP;
          card.style.opacity = String(inP * (1 - outP * .7));
          card.style.transform = `translate3d(${driftX}px, ${driftY}px, 0) scale(${mix(.82, 1, inP)}) rotate(${rotate}deg)`;
        });
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
