"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import type { KulturaProductOrbit } from "./kultura-product-orbit";
import { useLanguage } from "./language-provider";
import { useNearViewport } from "./use-near-viewport";
import styles from "./kultura-product-orbit.module.css";

export function HomeShowroom(props: ComponentProps<typeof KulturaProductOrbit>) {
  const { locale, t } = useLanguage();
  const root = useRef<HTMLDivElement>(null);
  const nearby = useNearViewport(root);
  const [Orbit, setOrbit] = useState<typeof KulturaProductOrbit>();

  useEffect(() => {
    if (!nearby) return;
    let cancelled = false;
    void import("./kultura-product-orbit").then(({ KulturaProductOrbit }) => {
      if (!cancelled) setOrbit(() => KulturaProductOrbit);
    }).catch(() => {
      // Keep the heading and shop link available if the orbit chunk fails.
    });
    return () => { cancelled = true; };
  }, [nearby]);

  if (props.items?.length === 0) return null;

  return (
    <div ref={root} data-kultura-showroom-region>
      {Orbit ? <Orbit {...props} /> : (
        <section className={styles.section + " " + styles.placeholder}>
          <div className={styles.heading}>
            <h2>{locale === "ka" ? "აღმოაჩინე შენი ფორმა." : "EXPLORE THE FORM."}</h2>
            <Link className={styles.explore} href="/shop">{t("SHOP")} <span aria-hidden="true">↗</span></Link>
          </div>
        </section>
      )}
    </div>
  );
}
