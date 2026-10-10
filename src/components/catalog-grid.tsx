"use client";

import { useLanguage } from "./language-provider";
import { useDeferredValue, useMemo, useState } from "react";
import type { Product, Category } from "@/lib/catalog";
import { ProductCard } from "./product-card";
import { categoryDisplayName, colorDisplayName } from "@/lib/category-i18n";
import styles from "./catalog-filters.module.css";

function unique(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function gelToMinor(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed || !/^\d{1,8}(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function CatalogGrid({
  products,
  categories,
  initialCategory = "All",
}: {
  products: Product[];
  categories: Category[];
  initialCategory?: string;
}) {
  const { t, locale } = useLanguage();
  const lockedCategory = initialCategory !== "All";
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStock, setInStock] = useState(false);
  const [sort, setSort] = useState("featured");

  const baseProducts = useMemo(
    () => products.filter((p) => category === "All" || p.category === category),
    [products, category],
  );

  const indexedProducts = useMemo(
    () =>
      baseProducts.map((product) => ({
        product,
        searchText: [
          product.name,
          product.description,
          product.category,
          categoryDisplayName(locale, product.category, product.categorySlug),
          ...product.variants.flatMap((variant) => [
            variant.sku,
            variant.size,
            variant.color,
            colorDisplayName(locale, variant.color),
          ]),
        ]
          .join(" ")
          .toLowerCase(),
      })),
    [baseProducts, locale],
  );

  const sizes = useMemo(
    () => unique(baseProducts.flatMap((p) => p.variants.map((v) => v.size))),
    [baseProducts],
  );
  const colors = useMemo(
    () => unique(baseProducts.flatMap((p) => p.variants.map((v) => v.color))),
    [baseProducts],
  );

  const visible = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const min = gelToMinor(minPrice);
    const max = gelToMinor(maxPrice);
    const needsVariantFilter = Boolean(size || color || inStock);

    return indexedProducts
      .filter(({ product, searchText }) => {
        if (q && !searchText.includes(q)) return false;
        if (min !== null && product.price < min) return false;
        if (max !== null && product.price > max) return false;
        if (
          needsVariantFilter &&
          !product.variants.some(
            (variant) =>
              (!size || variant.size === size) &&
              (!color || variant.color === color) &&
              (!inStock || variant.stock > 0),
          )
        )
          return false;
        return true;
      })
      .map(({ product }) => product)
      .sort((a, b) => {
        if (sort === "low") return a.price - b.price;
        if (sort === "high") return b.price - a.price;
        if (sort === "newest")
          return Date.parse(b.createdAt) - Date.parse(a.createdAt);
        return Number(b.featured) - Number(a.featured);
      });
  }, [
    indexedProducts,
    deferredQuery,
    minPrice,
    maxPrice,
    size,
    color,
    inStock,
    sort,
  ]);

  const filterCount =
    [size, color, minPrice, maxPrice].filter(Boolean).length + Number(inStock);
  const activeLabels = [
    size ? `SIZE ${size}` : "",
    color ? colorDisplayName(locale, color) : "",
    minPrice ? `FROM GEL ${minPrice}` : "",
    maxPrice ? `TO GEL ${maxPrice}` : "",
    inStock ? "IN STOCK" : "",
  ].filter(Boolean);

  function clearAll() {
    setQuery("");
    setSize("");
    setColor("");
    setMinPrice("");
    setMaxPrice("");
    setInStock(false);
    setSort("featured");
    if (!lockedCategory) setCategory("All");
  }

  const hasAnyControl = Boolean(
    query ||
      filterCount ||
      sort !== "featured" ||
      (!lockedCategory && category !== "All"),
  );

  return (
    <>
      <div className={styles.toolbar}>
        {!lockedCategory ? (
          <div
            className="category-filters"
            aria-label={t("Filter products by category")}
          >
            {["All", ...categories.map((c) => c.name)].map((c) => (
              <button
                className={category === c ? "active" : ""}
                aria-pressed={category === c}
                key={c}
                onClick={() => setCategory(c)}
              >
                {c === "All" ? t("All") : categoryDisplayName(locale, c, categories.find((item) => item.name === c)?.slug)}
              </button>
            ))}
          </div>
        ) : null}

        <div className={styles.searchRow}>
          <div>
            <label htmlFor="catalog-search" className="sr-only">
              {t("Search products")}
            </label>
            <input
              id="catalog-search"
              type="search"
              placeholder={t("Search products, colours, sizes or SKU")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div>
            <label className="sr-only" htmlFor="catalog-sort">
              {t("Sort products")}
            </label>
            <select
              id="catalog-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="featured">{t("Featured")}</option>
              <option value="newest">{t("Newest")}</option>
              <option value="low">{t("Price: low to high")}</option>
              <option value="high">{t("Price: high to low")}</option>
            </select>
          </div>
        </div>

        <details className={styles.filterPanel}>
          <summary className={styles.filterSummary}>
            <span>{t("FILTERS")}</span>
            <span className={styles.filterCount}>{filterCount}</span>
          </summary>
          <div className={styles.filterBody}>
            <div className={styles.field}>
              <label htmlFor="filter-size">{t("Size")}</label>
              <select
                id="filter-size"
                value={size}
                onChange={(e) => setSize(e.target.value)}
              >
                <option value="">{t("All sizes")}</option>
                {sizes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="filter-color">{t("Color")}</label>
              <select
                id="filter-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              >
                <option value="">{t("All colors")}</option>
                {colors.map((item) => (
                  <option key={item} value={item}>
                    {colorDisplayName(locale, item)}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label>{t("Price range · GEL")}</label>
              <div className={styles.priceFields}>
                <input
                  aria-label={t("Minimum price in GEL")}
                  inputMode="decimal"
                  placeholder={t("Min")}
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
                <input
                  aria-label={t("Maximum price in GEL")}
                  inputMode="decimal"
                  placeholder={t("Max")}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
            </div>

            <label className={styles.stockToggle}>
              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) => setInStock(e.target.checked)}
              />
              {t("IN STOCK ONLY")}
            </label>

            <button
              type="button"
              className={styles.clearButton}
              disabled={!hasAnyControl}
              onClick={clearAll}
            >
              {t("CLEAR ALL")}
            </button>
          </div>
        </details>
      </div>

      <div className={styles.resultMeta} role="status" aria-live="polite">
        <p className="eyebrow">{visible.length} {t("PIECES")}</p>
        {activeLabels.length ? (
          <p className={styles.activeSummary}>{activeLabels.join(" · ")}</p>
        ) : null}
      </div>

      <div className="product-grid">
        {visible.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
      {visible.length === 0 && (
        <div className="empty-state">
          <h2>{t("No matching pieces.")}</h2>
          <p>
            {t("Try clearing a filter, changing the price range or using another search.")}
          </p>
          {hasAnyControl ? (
            <button
              type="button"
              className="button secondary"
              onClick={clearAll}
            >
              {t("CLEAR FILTERS")}
            </button>
          ) : null}
        </div>
      )}
    </>
  );
}
