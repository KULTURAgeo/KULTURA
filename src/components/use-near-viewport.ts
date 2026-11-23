"use client";

import { useEffect, useState, type RefObject } from "react";

export function useNearViewport(target: RefObject<HTMLElement | null>) {
  const [nearby, setNearby] = useState(false);

  useEffect(() => {
    if (!target.current || nearby) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setNearby(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      setNearby(true);
    }, { rootMargin: "480px 0px" });
    observer.observe(target.current);
    return () => observer.disconnect();
  }, [nearby, target]);

  return nearby;
}
