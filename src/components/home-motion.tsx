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
      // Sticky runway for the in-phone feed, globe enlargement and handoff.
      // The phone never gets a second zoom after the feed completes.
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

        // Reversible chapters: phone entry -> modest initial zoom -> products
        // scroll within the stationary phone -> vertical reposition only ->
        // enlarge ONLY the globe button -> reveal next fullscreen scene.
        const entry = smooth(range(p, 0.02, 0.16));
        const zoom = smooth(range(p, 0.19, 0.37));

        const phoneWidth = Math.max(phone.offsetWidth, 1);
        const phoneHeight = Math.max(phone.offsetHeight, 1);
        const globeWidth = Math.max(phoneLogo?.offsetWidth ?? 64, 1);
        const globeHeight = Math.max(phoneLogo?.offsetHeight ?? 26, 1);
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
        // The product feed finishes at p=.73. DO NOT ZOOM THE PHONE AGAIN.
        // The phone only moves up until its bottom globe is at screen centre.
        // No background zoom or camera transform occurs in this chapter.
        const globeApproach = smooth(range(p, 0.74, 0.84));
        const phonePanY = -globeY * scale * globeApproach;
        const phoneFade = smooth(range(p, 0.969, 0.997));
        phone.style.transform =
          `translate3d(-50%, calc(-50% + ${entryOffset + phonePanY}px), 0) scale(${scale})`;
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

        const globeEmphasis = 1;
        if (phoneLogo) {
          phoneLogo.style.transform = `scale(${globeEmphasis})`;
          phoneLogo.style.opacity = String(1 - smooth(range(p, 0.85, 0.89)));
          phoneLogo.style.zIndex = "20";
        }

        if (phoneTransition) {
          // Anchor the portal to the real, rendered globe's screen position.
          // The phone itself and the photograph remain at their fixed sizes.
          // The current frame's rect is stable before portal entry because
          // the globe approach ends at p=.84.
          const globeRect = phoneLogo?.getBoundingClientRect();
          const globeCx = globeRect
            ? globeRect.left + globeRect.width / 2 : viewportWidth / 2;
          const globeCy = globeRect
            ? globeRect.top + globeRect.height / 2 : viewportHeight / 2;
          const globePhysicalWidth = globeRect?.width ?? globeWidth * scale;
          const globePhysicalHeight = globeRect?.height ?? globeHeight * scale;

          // The globe icon becomes a wide button inside the phone, similar
          // to the reference, before that SAME button becomes the new page.
          const portalEntry = smooth(range(p, 0.852, 0.881));
          const buttonGrow = smooth(range(p, 0.868, 0.936));
          // The real phone stays at its settled scale. As ONLY the globe
          // expands, the photograph and grid behind it drift closer, giving
          // the sensation of entering the button without re-zooming the phone.
          // Tie both to one scroll progress value for exact sync and rewind.
          const backdropScale = mix(
            1,
            viewportWidth < 720 ? 1.22 : 1.30,
            buttonGrow,
          );
          const backdropLift = mix(0, -16, buttonGrow);
          demoBackdrop.style.transform =
            `translate3d(0, ${backdropLift}px, 0) scale(${backdropScale})`;
          const portalGrow = smooth(range(p, 0.938, 0.992));
          const sceneIn = smooth(range(p, 0.970, 0.998));
          const panelWidth = Math.min(
            viewportWidth * 0.88, phoneWidth * scale * 0.86,
          );
          const panelHeight = Math.min(
            viewportHeight * 0.17,
            Math.max(globePhysicalHeight * 1.7, 48),
          );
          const portalWidth = mix(globePhysicalWidth, panelWidth, buttonGrow);
          const portalHeight = mix(globePhysicalHeight, panelHeight, buttonGrow);
          const insetLeft = Math.max(0, globeCx - portalWidth / 2);
          const insetRight = Math.max(0, viewportWidth - globeCx - portalWidth / 2);
          const insetTop = Math.max(0, globeCy - portalHeight / 2);
          const insetBottom = Math.max(0, viewportHeight - globeCy - portalHeight / 2);
          const portalRadius = mix(
            Math.min(globePhysicalHeight / 2, 24), 17, buttonGrow,
          );

          phoneTransition.style.opacity = String(portalEntry);
          phoneTransition.style.clipPath =
            `inset(${mix(insetTop, 0, portalGrow)}px ${mix(insetRight, 0, portalGrow)}px ${mix(insetBottom, 0, portalGrow)}px ${mix(insetLeft, 0, portalGrow)}px round ${mix(portalRadius, 0, portalGrow)}px)`;

          if (portalAccent) {
            // Keep the bright panel attached to the actual globe (NOT at the
            // centre of the screen while the globe is still elsewhere).
            portalAccent.style.left = `${globeCx}px`;
            portalAccent.style.top = `${globeCy}px`;
            portalAccent.style.width = `${panelWidth}px`;
            portalAccent.style.height = `${panelHeight}px`;
            const accentIn = smooth(range(p, 0.873, 0.926));
            const accentOut = 1 - smooth(range(p, 0.956, 0.980));
            portalAccent.style.opacity = String(accentIn * accentOut);
          }

          if (sceneLogo) {
            const logoIn = smooth(range(p, 0.955, 0.991));
            const logoSettle = smooth(range(p, 0.953, 0.994));
            const logoY = mix(viewportHeight * 0.035, 0, logoSettle);
            sceneLogo.style.opacity = String(logoIn);
            sceneLogo.style.transform = `translate(-50%, calc(-50% + ${logoY}px)) scale(${mix(.18, 1, logoSettle)})`;
          }

          if (transitionScene) {
            const sceneTravel = smooth(range(p, 0.974, 0.999));
            transitionScene.style.opacity = String(sceneIn);
            transitionScene.style.transform = `translate3d(0, ${mix(12, -8, sceneTravel)}px, 0) scale(${mix(.99, 1, sceneTravel)})`;
            transitionScene.style.willChange = "transform, opacity";
          }

          if (transitionCenter) {
            const centerGrow = smooth(range(p, 0.978, 0.999));
            transitionCenter.style.transform = `translate(-50%, -50%) scale(${mix(.36, 1, centerGrow)})`;
          }

          transitionFloats.forEach((card, index) => {
            const start = 0.966 + index * 0.006;
            const end = 0.990 + index * 0.002;
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

          const backdropOut = smooth(range(p, 0.970, 0.999));
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
