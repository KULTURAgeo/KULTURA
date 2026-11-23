"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { KulturaProductOrbit } from "@/components/kultura-product-orbit";
import type { ShowroomCard } from "@/lib/showroom/model";
import type { ShowroomCategoryOption, ShowroomItem, ShowroomProductOption } from "@/app/admin/showroom/repository";
import { PreviewImageInput } from "./preview-image-input";
import styles from "./showroom-editor.module.css";

export function ShowroomItemFields({
  item,
  products,
  categories,
  savedCards,
  savedPhoto,
}: {
  item?: ShowroomItem;
  products: ShowroomProductOption[];
  categories: ShowroomCategoryOption[];
  savedCards: ShowroomCard[];
  savedPhoto?: string | null;
}) {
  const prefix = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [kind, setKind] = useState(item?.source_kind ?? "product");
  const [productId, setProductId] = useState(item?.product_id ?? "");
  const [categoryId, setCategoryId] = useState(item?.category_id ?? "");
  const [imageProductId, setImageProductId] = useState(item?.image_product_id ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [titleKa, setTitleKa] = useState(item?.title_ka ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [descriptionKa, setDescriptionKa] = useState(item?.description_ka ?? "");
  const selectedProduct = products.find(product => product.id === productId);
  const selectedCategory = categories.find(category => category.id === categoryId);
  const catalogPhoto = products.find(product => product.id === imageProductId && product.status === "active" && product.categoryActive)?.image
    ?? (kind === "product" ? selectedProduct?.image : selectedCategory?.image);
  const photo = localPhoto ?? (removePhoto ? null : savedPhoto) ?? catalogPhoto ?? null;
  const sourceName = kind === "product" ? selectedProduct?.name : selectedCategory?.name;
  const sourceUnavailable = kind === "product"
    ? Boolean(selectedProduct && (selectedProduct.status !== "active" || !selectedProduct.categoryActive))
    : Boolean(selectedCategory && !selectedCategory.is_active);
  const name = title.trim() || sourceName || "Your card";
  const details = description.trim() || (kind === "category" ? selectedCategory?.description.slice(0, 500) ?? "" : "");
  const previewCard: ShowroomCard = {
    id: item?.id ?? "draft-preview",
    title: name,
    titleKa: titleKa.trim() || name,
    description: details,
    descriptionKa: descriptionKa.trim() || details,
    image: photo,
    imageAlt: name,
    href: kind === "product" ? "/product/" + (selectedProduct?.slug ?? "") : "/shop/" + (selectedCategory?.slug ?? ""),
    kind,
  };
  const savedIndex = savedCards.findIndex(card => card.id === previewCard.id);
  const remainingCards = savedIndex < 0 ? savedCards : [...savedCards.slice(savedIndex + 1), ...savedCards.slice(0, savedIndex)];

  return (
    <div className={styles.editor}>
      <div className={styles.controls}>
        <label className="k-field" htmlFor={`${prefix}-kind`}>
          <span>LINK TO</span>
          <select id={`${prefix}-kind`} name="source_kind" value={kind}
            onChange={event => setKind(event.target.value as "product" | "category")}>
            <option value="product">Product</option>
            <option value="category">Category</option>
          </select>
        </label>

        {kind === "product" ? (
          <label className="k-field" htmlFor={`${prefix}-product`}>
            <span>PRODUCT</span>
            <select id={`${prefix}-product`} name="product_id" required value={productId}
              onChange={event => setProductId(event.target.value)}>
              <option value="">Choose a product</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name}{product.status !== "active" ? ` · ${product.status}` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="k-field" htmlFor={`${prefix}-category`}>
            <span>CATEGORY</span>
            <select id={`${prefix}-category`} name="category_id" required value={categoryId}
              onChange={event => setCategoryId(event.target.value)}>
              <option value="">Choose a category</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}{category.is_active ? "" : " · inactive"}
                </option>
              ))}
            </select>
          </label>
        )}

        {sourceUnavailable && (
          <p className="form-error">This source is unavailable in the shop. Its card stays hidden until you activate it or choose another.</p>
        )}

        <label className="k-field" htmlFor={`${prefix}-image`}>
          <span>PHOTO FROM CATALOG</span>
          <select id={`${prefix}-image`} name="image_product_id" value={imageProductId}
            onChange={event => setImageProductId(event.target.value)}>
            <option value="">Use the source photo automatically</option>
            {products.filter(product => product.image && product.status === "active" && product.categoryActive).map(product => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
        </label>

        <PreviewImageInput name="image" label="UPLOAD CARD PHOTO · OPTIONAL" onPreview={setLocalPhoto} />
        <p className="muted">JPEG, PNG or WebP · up to 3 MB. The uploaded photo takes priority over the catalog photo.</p>
        {savedPhoto && <label className="check-field">
          <input name="remove_image" type="checkbox" checked={removePhoto} disabled={Boolean(localPhoto)}
            onChange={event => setRemovePhoto(event.target.checked)} />
          Use the catalog photo instead
        </label>}

        <div className="form-grid">
          <label className="k-field" htmlFor={`${prefix}-title`}>
            <span>TITLE · ENGLISH</span>
            <input id={`${prefix}-title`} name="title" type="text" autoComplete="off" maxLength={120}
              value={title} onChange={event => setTitle(event.target.value)} placeholder={sourceName ?? "Use product or category name"} />
          </label>
          <label className="k-field" htmlFor={`${prefix}-title-ka`}>
            <span>TITLE · ქართული</span>
            <input id={`${prefix}-title-ka`} name="title_ka" type="text" lang="ka" autoComplete="off"
              maxLength={120} value={titleKa} onChange={event => setTitleKa(event.target.value)} />
          </label>
          <label className="k-field" htmlFor={`${prefix}-description`}>
            <span>DESCRIPTION · ENGLISH</span>
            <textarea id={`${prefix}-description`} name="description" maxLength={400} rows={3}
              value={description} onChange={event => setDescription(event.target.value)} />
          </label>
          <label className="k-field" htmlFor={`${prefix}-description-ka`}>
            <span>DESCRIPTION · ქართული</span>
            <textarea id={`${prefix}-description-ka`} name="description_ka" lang="ka" maxLength={400} rows={3}
              value={descriptionKa} onChange={event => setDescriptionKa(event.target.value)} />
          </label>
        </div>

        <div className="form-grid">
          <label className="k-field" htmlFor={`${prefix}-position`}>
            <span>DISPLAY ORDER</span>
            <input id={`${prefix}-position`} name="sort_position" type="number" min={0} max={1000000} step={1}
              required defaultValue={item?.sort_position ?? 0} />
          </label>
          <label className={`check-field ${styles.visibility}`}>
            <input name="is_active" type="checkbox" defaultChecked={item?.is_active ?? true} />
            Show this card
          </label>
        </div>
      </div>

      <aside className={styles.preview} aria-label="Card preview">
        <div className={styles.photo}>
          {photo ? (
            <Image src={photo} alt={title.trim() || sourceName || "Selected card photo"} fill
              unoptimized={Boolean(localPhoto)}
              sizes="(max-width: 720px) 70vw, 240px" style={{ objectFit: "contain" }} />
          ) : <span className={styles.photoPlaceholder}>Choose a source or photo</span>}
        </div>
        <strong>{name}</strong>
        <button type="button" className="button secondary" onClick={() => {
          dialog.current?.showModal();
          setPreviewOpen(true);
        }}>PREVIEW IN 3D</button>
      </aside>
      <dialog className={styles.dialog} ref={dialog} aria-labelledby={prefix + "-preview"} onClose={() => setPreviewOpen(false)}>
        <div className={styles.dialogHeader}>
          <h2 id={prefix + "-preview"}>3D SHOWROOM PREVIEW</h2>
          <button type="button" className="button secondary" onClick={() => dialog.current?.close()}>CLOSE</button>
        </div>
        {previewOpen && <KulturaProductOrbit preview products={[]} categories={[]} items={[previewCard, ...remainingCards]} />}
      </dialog>
    </div>
  );
}
