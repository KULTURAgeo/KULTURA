"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { money } from "@/lib/catalog";
import { PreviewImageInput } from "./preview-image-input";
import styles from "./product-image-picker.module.css";

export function ProductImagePicker({ product, hasMainImage = false }: {
  product?: { name: string; price: number };
  hasMainImage?: boolean;
}) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", price: "" });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (product) return;
    const form = rootRef.current?.closest("form");
    if (!form) return;
    function syncDraft(event: Event) {
      if (!(event.target instanceof HTMLInputElement) || !["name", "price"].includes(event.target.name)) return;
      const fields = event.target.form?.elements;
      const name = fields?.namedItem("name") as HTMLInputElement | null;
      const price = fields?.namedItem("price") as HTMLInputElement | null;
      setDraft({ name: name?.value.trim() ?? "", price: price?.value ?? "" });
    }
    form.addEventListener("input", syncDraft);
    return () => form.removeEventListener("input", syncDraft);
  }, [product]);

  const name = (product?.name || draft.name || "Product name").replace("KULTURA ", "");
  const price = product?.price ?? (draft.price === "" ? null : Math.round(Number(draft.price) * 100));

  return (
    <div ref={rootRef}>
      <PreviewImageInput name="image" label={product ? "IMAGE FILE" : "MAIN PRODUCT IMAGE · OPTIONAL"}
        required={Boolean(product)} onPreview={setPhoto} />
      {photo && <section className={styles.previews} aria-label="Product upload previews">
        <figure>
          <figcaption>{hasMainImage ? "CATALOG CARD · IF SET AS MAIN PHOTO" : "CATALOG CARD"}</figcaption>
          <article className="product-card">
            <div className="product-image">
              <Image src={photo} alt={name} fill sizes="320px" unoptimized />
            </div>
            <div className="product-meta">
              <h3>{name}</h3>
              {price !== null && Number.isFinite(price) && <span>{money(price)}</span>}
            </div>
          </article>
        </figure>
        <figure>
          <figcaption>PRODUCT PAGE · GALLERY</figcaption>
          <div className="gallery-main">
            <Image src={photo} alt={name} fill sizes="520px" unoptimized />
          </div>
        </figure>
      </section>}
    </div>
  );
}
