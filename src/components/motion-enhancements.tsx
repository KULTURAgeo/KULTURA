"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Progressive enhancements: no replacement wheel handler, no scroll-jacking
 * and no new animation dependency. Native touch scrolling stays untouched.
 * The long-form globe scene remains controlled by HomeMotion.
 */
type ProductPortal = {
  layer: HTMLDivElement;
  source: DOMRect;
  destination: string;
  timer: number;
};

let portal: ProductPortal | null = null;

function discardPortal() {
  if (!portal) return;
  window.clearTimeout(portal.timer);
  portal.layer.remove();
  portal = null;
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function startProductPortal(link: HTMLAnchorElement) {
  if (reducedMotion()) return;
  const card = link.closest(".product-card");
  const image = card?.querySelector<HTMLImageElement>(".product-image img");
  const frame = image?.closest<HTMLElement>(".product-image");
  if (!image || !frame || !image.complete) return;
  const source = frame.getBoundingClientRect();
  if (source.width < 30 || source.height < 30) return;

  discardPortal();
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.className = "k-product-portal";
  layer.style.cssText =
    `left:${source.left}px;top:${source.top}px;width:${source.width}px;height:${source.height}px;`;
  const clone = document.createElement("img");
  clone.src = image.currentSrc || image.src;
  clone.alt = "";
  clone.draggable = false;
  clone.style.objectFit = getComputedStyle(image).objectFit || "contain";
  layer.appendChild(clone);
  document.body.appendChild(layer);
  const href = new URL(link.href, location.href);
  portal = {
    layer,
    source,
    destination: href.pathname,
    timer: window.setTimeout(discardPortal, 2200),
  };
}

function completeProductPortal(pathname: string) {
  if (!portal) return;
  if (portal.destination !== pathname) {
    discardPortal();
    return;
  }
  const active = portal;
  const frame = document.querySelector<HTMLElement>(".product-detail .gallery-main");
  if (!frame) {
    discardPortal();
    return;
  }
  const target = frame.getBoundingClientRect();
  const { source, layer } = active;
  const dx = target.left - source.left;
  const dy = target.top - source.top;
  const scaleX = target.width / source.width;
  const scaleY = target.height / source.height;
  const animation = layer.animate(
    [
      { transform: "translate3d(0, 0, 0) scale(1, 1)", opacity: 1 },
      { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scaleX}, ${scaleY})`, opacity: 0.95, offset: 0.82 },
      { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scaleX}, ${scaleY})`, opacity: 0 },
    ],
    { duration: 580, easing: "cubic-bezier(0.22,1,0.36,1)", fill: "forwards" },
  );
  void animation.finished.then(
    () => { if (portal === active) discardPortal(); },
    () => { if (portal === active) discardPortal(); },
  );
}

export function MotionEnhancements() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Disable document-wide effects for users who request reduced motion.
    if (reducedMotion()) {
      discardPortal();
      return;
    }
    document.documentElement.dataset.motionEnhanced = "true";
    const main = document.getElementById("main");
    if (!main) return;

    document.documentElement.classList.remove("k-route-leaving");
    main.classList.remove("k-route-enter");
    // Restart entrance animation for client-side navigations.
    void main.offsetWidth;
    main.classList.add("k-route-enter");

    const selectors = [
      ".product-card",
      ".category-grid > a",
      ".section-heading",
      ".page-title",
      ".drop-panel",
      ".information > p",
      ".newsletter-inner",
    ];

    const tracked: HTMLElement[] = [];
    const seen = new WeakSet<HTMLElement>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("k-in-view");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.10, rootMargin: "0px 0px -34px 0px" });

    // Server-streamed shop results may arrive after hydration. Observe them too.
    const observeTargets = () => {
      const candidates = Array.from(main.querySelectorAll<HTMLElement>(selectors.join(",")));
      for (const element of candidates) {
        if (seen.has(element) || element.closest("[data-demo-track]") || element.matches("[data-reveal]")) continue;
        seen.add(element);
        tracked.push(element);
        const parent = element.parentElement;
        const siblings = parent
          ? Array.from(parent.children).filter((child) => child.matches(".product-card, .category-grid > a"))
          : [];
        const index = siblings.indexOf(element);
        element.style.setProperty("--k-stagger", `${Math.max(0, index) % 4 * 115}ms`);
        element.classList.add("k-motion-reveal");
        observer.observe(element);
      }
    };
    observeTargets();
    const mutationObserver = new MutationObserver(observeTargets);
    mutationObserver.observe(main, { childList: true, subtree: true });
    let navigationTimer: number | null = null;

    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || event.defaultPrevented) return;
      if (document.documentElement.dataset.motionMode === "soft") return;
      const source = event.target;
      if (!(source instanceof Element)) return;
      const link = source.closest<HTMLAnchorElement>("a[href]");
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      if (link.closest("dialog, [contenteditable='true']")) return;
      const url = new URL(link.href, location.href);
      const current = new URL(location.href);
      if (url.origin !== location.origin || (url.pathname === current.pathname && url.search === current.search)) return;
      // Enhance only storefront pages. Accounts, forms and checkout use normal navigation.
      const storefront = (path: string) =>
        path === "/" || path === "/shop" || path.startsWith("/shop/")
        || path === "/drops" || path === "/about" || path.startsWith("/product/");
      if (!storefront(url.pathname) || !storefront(current.pathname)) return;

      // Delay the route for a brief, perceptible departure; Next still handles client navigation.
      event.preventDefault();
      if (url.pathname.startsWith("/product/")) startProductPortal(link);
      document.documentElement.classList.add("k-route-leaving");
      if (navigationTimer !== null) window.clearTimeout(navigationTimer);
      navigationTimer = window.setTimeout(() => {
        navigationTimer = null;
        router.push(url.pathname + url.search + url.hash);
      }, 270);
    };
    document.addEventListener("click", onClick, { capture: true });
    const frame = window.requestAnimationFrame(() => completeProductPortal(pathname));
    const enterTimer = window.setTimeout(() => main.classList.remove("k-route-enter"), 810);

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      if (navigationTimer !== null) window.clearTimeout(navigationTimer);
      window.cancelAnimationFrame(frame);
      window.clearTimeout(enterTimer);
      document.removeEventListener("click", onClick, { capture: true });
      for (const element of tracked) {
        element.classList.remove("k-motion-reveal", "k-in-view");
        element.style.removeProperty("--k-stagger");
      }
      main.classList.remove("k-route-enter");
      document.documentElement.classList.remove("k-route-leaving");
    };
  }, [pathname, router]);

  return null;
}
