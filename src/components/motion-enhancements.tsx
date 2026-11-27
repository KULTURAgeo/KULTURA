"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useLanguage } from "./language-provider";

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
  const image = card?.querySelector<HTMLImageElement>(".product-image img:not([data-card-photo-outgoing])");
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
  const search = useSearchParams().toString();
  const { locale } = useLanguage();
  const bar = useRef<HTMLDivElement>(null);
  const previousPath = useRef<string | null>(null);
  const committedAddress = useRef("");
  const finishNavigation = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    finishNavigation.current();
    committedAddress.current = location.pathname + location.search;
    const animate = previousPath.current !== null && previousPath.current !== pathname && !reducedMotion();
    previousPath.current = pathname;
    if (!animate) {
      discardPortal();
      return;
    }
    const frame = requestAnimationFrame(() => {
      completeProductPortal(pathname);
      document.getElementById("main")?.animate([{ opacity: .84 }, { opacity: 1 }], {
        duration: 250, easing: "ease-out",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, search]);

  useEffect(() => {
    const progress = bar.current;
    if (!progress) return;
    let show = 0;
    let expire = 0;

    function finish() {
      window.clearTimeout(show);
      window.clearTimeout(expire);
      if (progress) progress.hidden = true;
    }

    function begin() {
      window.clearTimeout(show);
      window.clearTimeout(expire);
      show = window.setTimeout(() => {
        if (progress) progress.hidden = false;
      }, 110);
      expire = window.setTimeout(finish, 15000);
    }

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      if (link.origin !== location.origin || link.pathname + link.search === location.pathname + location.search) return;
      if (!["http:", "https:"].includes(link.protocol)) return;
      begin();
      if (link.pathname.startsWith("/product/")) startProductPortal(link);
      else discardPortal();
    }

    function onHistory() {
      if (location.pathname + location.search !== committedAddress.current) begin();
    }

    finishNavigation.current = finish;
    document.addEventListener("click", onClick, { capture: true });
    window.addEventListener("popstate", onHistory);
    window.addEventListener("pageshow", finish);
    return () => {
      finish();
      discardPortal();
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("popstate", onHistory);
      window.removeEventListener("pageshow", finish);
    };
  }, []);

  return <div ref={bar} className="route-progress" role="progressbar" data-route-progress
    aria-label={locale === "ka" ? "გვერდი იტვირთება" : "Loading page"} hidden />;
}
