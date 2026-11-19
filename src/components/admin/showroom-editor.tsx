"use client";

import Image from "next/image";
import { useId, useState } from "react";
import styles from "./showroom-editor.module.css";

type ProductOption = {
  id: string;
  name: string;
  slug: string;
  status: string;
  image: string | null;
};

type CategoryOption = { id: string; name: string; slug: string; is_active: boolean; image?: string | null };

type ShowroomItem = {
  source_kind: "product" | "category";
  product_id: string | null;
  category_id: string | null;
  image_product_id: string | null;
  title: string;
  title_ka: string;
  description: string;
  description_ka: string;
  sort_position: number;
  is_active: boolean;
};

export function ShowroomItemFields({
  item,
  products,
  categories,
}: {
  item?: ShowroomItem;
  products: ProductOption[];
  categories: CategoryOption[];
}) {
  const prefix = useId();
  const [kind, setKind] = useState(item?.source_kind ?? "product");
  const [productId, setProductId] = useState(item?.product_id ?? "");
  const [categoryId, setCategoryId] = useState(item?.category_id ?? "");
  const [imageProductId, setImageProductId] = useState(item?.image_product_id ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const selectedProduct = products.find(product => product.id === productId);
  const selectedCategory = categories.find(category => category.id === categoryId);
  const photo = products.find(product => product.id === imageProductId)?.image
    ?? (kind === "product" ? selectedProduct?.image : selectedCategory?.image);
  const sourceName = kind === "product" ? selectedProduct?.name : selectedCategory?.name;
  const sourceUnavailable = kind === "product"
    ? Boolean(selectedProduct && selectedProduct.status !== "active")
    : Boolean(selectedCategory && !selectedCategory.is_active);

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
          <span>CARD PHOTO</span>
          <select id={`${prefix}-image`} name="image_product_id" value={imageProductId}
            onChange={event => setImageProductId(event.target.value)}>
            <option value="">Use the source photo automatically</option>
            {products.filter(product => product.image && product.status === "active").map(product => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
        </label>

        <div className="form-grid">
          <label className="k-field" htmlFor={`${prefix}-title`}>
            <span>TITLE · ENGLISH</span>
            <input id={`${prefix}-title`} name="title" type="text" autoComplete="off" maxLength={120}
              value={title} onChange={event => setTitle(event.target.value)} placeholder={sourceName ?? "Use product or category name"} />
          </label>
          <label className="k-field" htmlFor={`${prefix}-title-ka`}>
            <span>TITLE · ქართული</span>
            <input id={`${prefix}-title-ka`} name="title_ka" type="text" lang="ka" autoComplete="off"
              maxLength={120} defaultValue={item?.title_ka ?? ""} />
          </label>
          <label className="k-field" htmlFor={`${prefix}-description`}>
            <span>DESCRIPTION · ENGLISH</span>
            <textarea id={`${prefix}-description`} name="description" maxLength={400} rows={3}
              defaultValue={item?.description ?? ""} />
          </label>
          <label className="k-field" htmlFor={`${prefix}-description-ka`}>
            <span>DESCRIPTION · ქართული</span>
            <textarea id={`${prefix}-description-ka`} name="description_ka" lang="ka" maxLength={400} rows={3}
              defaultValue={item?.description_ka ?? ""} />
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
              sizes="(max-width: 720px) 70vw, 240px" style={{ objectFit: "contain" }} />
          ) : <span className={styles.photoPlaceholder}>Choose a source or photo</span>}
        </div>
        <strong>{title.trim() || sourceName || "YOUR CARD"}</strong>
        <span>{kind === "product" ? "VIEW PRODUCT ↗" : "EXPLORE CATEGORY ↗"}</span>
      </aside>
    </div>
  );
}
