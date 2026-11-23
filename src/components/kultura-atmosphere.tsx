"use client";

import Image from "next/image";
import { useEffect, useRef, type ReactNode } from "react";
import { useNearViewport } from "./use-near-viewport";
import styles from "./kultura-atmosphere.module.css";

const GLOBE_IMAGE = "/images/kultura-globe-scene.webp";
export function KulturaAtmosphere({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const mark = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);

  const nearby = useNearViewport(root);

  useEffect(() => {
    const story = root.current;
    const layer = field.current;
    const surface = canvas.current;
    const logo = mark.current;
    const logoImage = image.current;
    if (!nearby || !story || !layer || !surface || !logo || !logoImage) return;

    let cancelled = false;
    let stop: (() => void) | undefined;
    void import("./kultura-atmosphere-motion").then(({ startAtmosphere }) => {
      if (!cancelled) stop = startAtmosphere({ story, layer, surface, logo, logoImage });
    }).catch(() => {
      // The background and content still render if the motion chunk fails.
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [nearby]);

  return (
    <div className={styles.story} ref={root} data-kultura-story>
      <div className={styles.field} ref={field} aria-hidden="true">
        <div className={styles.ambientLight} />
        <div className={styles.dust} data-kultura-dust />
        <div className={styles.orbitOne} />
        <div className={styles.orbitTwo} />
        <div className={styles.motionPlane} data-kultura-motion-plane>
          <div className={styles.chromeMark} ref={mark}>
            <div className={`${styles.globeHalf} ${styles.globeLeft}`} data-kultura-globe-half="left">
              <Image ref={image} src={GLOBE_IMAGE} alt="" fill unoptimized loading="lazy"
                sizes="(max-width: 720px) 78vw, 520px" />
            </div>
            <div className={`${styles.globeHalf} ${styles.globeRight}`} data-kultura-globe-half="right">
              <Image src={GLOBE_IMAGE} alt="" fill unoptimized loading="lazy"
                sizes="(max-width: 720px) 78vw, 520px" />
            </div>
          </div>
          <canvas className={styles.particles} ref={canvas} data-kultura-morph-canvas />
          <div className={styles.wordFallback}>KULTURA</div>
        </div>
        <div className={styles.groundGlow} />
        <div className={styles.grain} />
      </div>
      {children}
    </div>
  );
}
