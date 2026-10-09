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
      const staticPhone = node.querySelector<HTMLElement>("[data-phone]");
      const staticBackdrop = node.querySelector<HTMLElement>("[data-demo-backdrop]");
      const staticTrack = node.querySelector<HTMLElement>("[data-demo-track]");
      if (staticTrack) staticTrack.style.height = "100svh";
      if (staticPhone) {
        staticPhone.style.transform = "translate3d(-50%, -50%, 0) scale(1)";
        staticPhone.style.opacity = "1";
      }
      if (staticBackdrop) staticBackdrop.style.opacity = "1";
      return () => {
        observer.disconnect();
        document.body.classList.remove("kultura-motion-home");
      };
    }

    const hero = node.querySelector<HTMLElement>("[data-hero]");
    const heroCopy = node.querySelector<HTMLElement>("[data-hero-copy]");
    const demoTrack = node.querySelector<HTMLElement>("[data-demo-track]");
    const demoBackdrop = node.querySelector<HTMLElement>("[data-demo-backdrop]");
    const demoCamera = node.querySelector<HTMLElement>("[data-demo-camera]");
    const phone = node.querySelector<HTMLElement>("[data-phone]");
    const phoneLogo = node.querySelector<HTMLElement>("[data-phone-logo]");
    const phoneSlides = Array.from(node.querySelectorAll<HTMLElement>("[data-phone-slide]"));
    const demoCaption = node.querySelector<HTMLElement>("[data-demo-caption]");
    const phoneTransition = node.querySelector<HTMLElement>("[data-phone-transition]");
    const portalAccent = node.querySelector<HTMLElement>("[data-phone-portal-accent]");
    const sceneLogo = node.querySelector<HTMLElement>("[data-scene-logo]");
    const transitionScene = node.querySelector<HTMLElement>("[data-transition-scene]");
    const transitionCenter = node.querySelector<HTMLElement>("[data-transition-center]");
    const transitionFloats = Array.from(node.querySelectorAll<HTMLElement>("[data-transition-float]"));

    if (demoTrack) {
      // Extra sticky scroll distance is for the in-phone feed and the globe
      // handoff, not for making the phone itself larger.
      demoTrack.style.height = "460svh";
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

      // Read geometry before mutating styles to avoid forced layouts while scrolling.
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

        // Scroll chapters, each reversible: entry -> controlled zoom ->
        // internal product feed -> bottom globe focus -> expanding globe
        // button -> full-screen scene. Keep stages from overlapping.
        const entry = smooth(range(p, 0.02, 0.16));
        const zoom = smooth(range(p, 0.19, 0.37));

        const phoneWidth = Math.max(phone.offsetWidth, 1);
        const phoneHeight = Math.max(phone.offsetHeight, 1);
        const globeWidth = Math.max(phoneLogo?.offsetWidth ?? 64, 1);
        const globeHeight = Math.max(phoneLogo?.offsetHeight ?? 26, 1);
        const globeX = (phoneLogo?.offsetLeft ?? (phoneWidth - globeWidth) / 2)
          + globeWidth / 2 - phoneWidth / 2;
        const globeY = (phoneLogo?.offsetTop ?? phoneHeight * 0.91)
          + globeHeight / 2 - phoneHeight / 2;

        // First frame: the full phone is visible, ~82% of viewport height.
        const initialScale = Math.min(
          2.2,
          viewportHeight * 0.82 / phoneHeight,
          viewportWidth * (viewportWidth < 720 ? 0.85 : 0.60) / phoneWidth,
        );
        // Second frame: a modest close-up (~1.34x, bounded on phones).
        // Keep the surrounding editorial backdrop visible.
        const zoomTarget = Math.max(initialScale, Math.min(
          initialScale * 1.34,
          viewportWidth * (viewportWidth < 720 ? 0.98 : 0.56) / phoneWidth,
          viewportHeight * 1.23 / phoneHeight,
        ));
        const scale = mix(initialScale * 0.82, initialScale, entry)
          * mix(1, zoomTarget / initialScale, zoom);
        const entryOffset = mix(viewportHeight * 0.62, 0, entry);
        // Once the product feed ends the *whole* scene moves toward the globe.
        // Never scroll/move the phone alone: it stays the same size throughout
        // all product cards, then shares a camera dolly with the background.
        const dolly = smooth(range(p, 0.76, 0.925));
        const dive = smooth(range(p, 0.929, 0.976));
        const cameraTarget = Math.min(5.25, Math.max(
          2.65,
          viewportWidth * (viewportWidth < 720 ? 0.68 : 0.34) / (globeWidth * scale),
        ));
        const cameraScale = Math.exp(Math.log(cameraTarget) * dolly)
          * mix(1, 1.52, dive);
        const cameraPanX = -globeX * scale * cameraScale * dolly;
        const cameraPanY = -globeY * scale * cameraScale * dolly;
        if (demoCamera) {
          demoCamera.style.transform =
            `translate3d(${cameraPanX}px, ${cameraPanY}px, 0) scale(${cameraScale})`;
        }

        const phoneFade = smooth(range(p, 0.972, 0.997));
        phone.style.transform = `translate3d(-50%, calc(-50% + ${entryOffset}px), 0) scale(${scale})`;
        phone.style.opacity = String(entry * (1 - phoneFade));

        // Keep the entire phone stationary while the customer scrolls through
        // full-height product cards clipped inside the phone viewport.
        const slidePosition = range(p, 0.42, 0.73)
          * Math.max(phoneSlides.length - 1, 0);
        phoneSlides.forEach((slide, index) => {
          const distance = index - slidePosition;
          slide.style.opacity = "1";
          slide.style.transform = `translate3d(0, ${distance * 100}%, 0)`;
          slide.style.zIndex = String(10 + phoneSlides.length - index);
        });

        const globeEmphasis = mix(1, 1.09, smooth(range(p, 0.87, 0.938)));
        if (phoneLogo) {
          phoneLogo.style.transform = `scale(${globeEmphasis})`;
          phoneLogo.style.opacity = String(1 - smooth(range(p, 0.940, 0.982)));
          phoneLogo.style.zIndex = "20";
        }

        if (phoneTransition) {
          // Expand first into a recognisable pill/button, then into the
          // next full-screen scene. Everything starts at the real globe position.
          // Meet the REAL globe only after the whole backdrop has zoomed.
          // The portal is a continuation of the camera move, not a pop-up.
          const portalEntry = smooth(range(p, 0.924, 0.943));
          const buttonGrow = smooth(range(p, 0.941, 0.963));
          const portalGrow = smooth(range(p, 0.964, 0.996));
          const sceneIn = smooth(range(p, 0.979, 0.999));
          const globeCx = viewportWidth / 2 + cameraPanX
            + globeX * scale * cameraScale;
          const globeCy = viewportHeight / 2 + cameraPanY
            + (entryOffset + globeY * scale) * cameraScale;
          const startWidth = globeWidth * scale * cameraScale * globeEmphasis;
          const startHeight = globeHeight * scale * cameraScale * globeEmphasis;
          const panelWidth = Math.min(560, viewportWidth * 0.75);
          const panelHeight = Math.min(128, viewportHeight * 0.21);
          const portalWidth = mix(startWidth, Math.max(startWidth, panelWidth), buttonGrow);
          const portalHeight = mix(startHeight, Math.max(startHeight, panelHeight), buttonGrow);
          const insetLeft = Math.max(0, globeCx - portalWidth / 2);
          const insetRight = Math.max(0, viewportWidth - globeCx - portalWidth / 2);
          const insetTop = Math.max(0, globeCy - portalHeight / 2);
          const insetBottom = Math.max(0, viewportHeight - globeCy - portalHeight / 2);
          const portalRadius = Math.min(portalHeight / 2, 32);
          phoneTransition.style.opacity = String(portalEntry);
          phoneTransition.style.clipPath = `inset(${mix(insetTop, 0, portalGrow)}px ${mix(insetRight, 0, portalGrow)}px ${mix(insetBottom, 0, portalGrow)}px ${mix(insetLeft, 0, portalGrow)}px round ${mix(portalRadius, 0, portalGrow)}px)`;

          if (portalAccent) {
            const accentIn = smooth(range(p, 0.948, 0.965));
            const accentOut = 1 - smooth(range(p, 0.977, 0.990));
            portalAccent.style.opacity = String(accentIn * accentOut);
          }

          if (sceneLogo) {
            const logoIn = smooth(range(p, 0.968, 0.993));
            const logoSettle = smooth(range(p, 0.968, 0.996));
            const logoY = mix(viewportHeight * 0.035, 0, logoSettle);
            sceneLogo.style.opacity = String(logoIn);
            sceneLogo.style.transform = `translate(-50%, calc(-50% + ${logoY}px)) scale(${mix(.18, 1, logoSettle)})`;
          }

          if (transitionScene) {
            const sceneTravel = smooth(range(p, 0.981, 0.999));
            transitionScene.style.opacity = String(sceneIn);
            transitionScene.style.transform = `translate3d(0, ${mix(12, -8, sceneTravel)}px, 0) scale(${mix(.99, 1, sceneTravel)})`;
            transitionScene.style.willChange = "transform, opacity";
          }

          if (transitionCenter) {
            const centerGrow = smooth(range(p, 0.983, 0.999));
            transitionCenter.style.transform = `translate(-50%, -50%) scale(${mix(.36, 1, centerGrow)})`;
          }

          transitionFloats.forEach((card, index) => {
            const start = 0.979 + index * 0.004;
            const end = 0.993 + index * 0.001;
            const local = smooth(range(p, start, Math.min(end, 0.995)));

            // Each card begins over the central product and fans out to its final slot.
            const fromX = index % 2 === 0 ? viewportWidth * 0.34 : -viewportWidth * 0.34;
            const fromY = index < 2 ? viewportHeight * 0.29 : -viewportHeight * 0.29;
            const x = mix(fromX, 0, local);
            const y = mix(fromY, 0, local);
            const cardScale = mix(0.34, 1, local);

            card.style.opacity = String(local);
            card.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${cardScale})`;
            card.style.transformOrigin = "center center";
          });

          const backdropOut = smooth(range(p, 0.976, 0.999));
          demoBackdrop.style.opacity = String(1 - backdropOut * 0.97);
        } else {
          demoBackdrop.style.opacity = "1";
        }

        if (demoCaption) {
          const enterCaption = smooth(range(p, 0.10, 0.18));
          const leaveCaption = 1 - smooth(range(p, 0.37, 0.45));
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
