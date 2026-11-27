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
  const [photos, setPhotos] = useState<string[]>([]);
  const [activePhoto, setActivePhoto] = useState(0);
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
  const mainPhoto = photos[0];
  const galleryPhoto = photos[activePhoto] ?? mainPhoto;

  return (
    <div ref={rootRef}>
      <PreviewImageInput name="image" label={product ? "PHOTO FILES" : "PRODUCT PHOTOS · OPTIONAL"}
        multiple required={Boolean(product)} onPreview={(urls) => { setPhotos(urls); setActivePhoto(0); }} />
      {mainPhoto && <section className={styles.previews} aria-label="Product upload previews">
        <figure>
          <figcaption>{hasMainImage ? "CATALOG CARD · IF SET AS MAIN PHOTO" : "CATALOG CARD"}</figcaption>
          <article className="product-card">
            <div className="product-image">
              <Image src={mainPhoto} alt={name} fill sizes="320px" unoptimized />
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
            <Image src={galleryPhoto} alt={name + " — photo " + (activePhoto + 1)} fill sizes="520px" unoptimized />
          </div>
          {photos.length > 1 && <div className={styles.thumbnails} aria-label="Preview selected photos">
            {photos.map((url, index) => (
              <button key={url} type="button" aria-label={`Preview photo ${index + 1}`}
                aria-pressed={index === activePhoto} onClick={() => setActivePhoto(index)}>
                <Image src={url} alt="" width={56} height={70} unoptimized />
              </button>
            ))}
          </div>}
        </figure>
      </section>}
    </div>
  );
}
