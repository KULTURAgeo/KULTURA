"use client";

import { useLanguage } from "./language-provider";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/catalog";
import styles from "./size-guide.module.css";

const apparelRows = [
  ["XS", "82–87", "66–71", "82–87"],
  ["S", "88–93", "72–77", "88–93"],
  ["M", "94–99", "78–83", "94–99"],
  ["L", "100–105", "84–89", "100–105"],
  ["XL", "106–113", "90–97", "106–113"],
  ["XXL", "114–121", "98–105", "114–121"],
] as const;

const footwearRows = [
  ["39", "24.5"],
  ["40", "25.2"],
  ["41", "25.9"],
  ["42", "26.6"],
  ["43", "27.2"],
  ["44", "27.9"],
  ["45", "28.6"],
] as const;

export function SizeGuide({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const footwear = /shoe|footwear|sneaker|boot/i.test(product.category);
  const sizes = [...new Set(product.variants.map((variant) => variant.size))];

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  return (
    <>
      <button className={styles.trigger} type="button" onClick={() => setOpen(true)}>
        {t("SIZE GUIDE ↗")}
      </button>
      {open ? (
        <div className={styles.overlay} role="presentation" onMouseDown={() => setOpen(false)}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="size-guide-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.head}>
              <div>
                <p className="eyebrow">{t("KULTURA / FIT REFERENCE")}</p>
                <h2 id="size-guide-title">{t("SIZE GUIDE")}</h2>
              </div>
              <button className={styles.close} type="button" aria-label={t("Close size guide")} onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
            <p className="muted">{t("Available for this product")}</p>
            <div className={styles.available}>
              {sizes.map((size) => <span key={size}>{size}</span>)}
            </div>
            <div className={styles.tableWrap}>
              {footwear ? (
                <table className={styles.table}>
                  <thead><tr><th>{t("EU SIZE")}</th><th>{t("FOOT LENGTH · CM")}</th></tr></thead>
                  <tbody>{footwearRows.map((row) => <tr key={row[0]}><td>{row[0]}</td><td>{row[1]}</td></tr>)}</tbody>
                </table>
              ) : (
                <table className={styles.table}>
                  <thead><tr><th>{t("SIZE")}</th><th>{t("CHEST · CM")}</th><th>{t("WAIST · CM")}</th><th>{t("HIP · CM")}</th></tr></thead>
                  <tbody>{apparelRows.map((row) => <tr key={row[0]}>{row.map((cell) => <td key={cell}>{cell}</td>)}</tr>)}</tbody>
                </table>
              )}
            </div>
            <p className={styles.note}>{t("General body-size reference. Final garment measurements and fit can vary by style.")}</p>
          </section>
        </div>
      ) : null}
    </>
  );
}
