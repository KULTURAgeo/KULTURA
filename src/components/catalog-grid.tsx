"use client";
import { useMemo, useState } from "react";
import type { Product, Category } from "@/lib/catalog";
import { ProductCard } from "./product-card";
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
  const lockedCategory = initialCategory !== "All";
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState("");
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

  const sizes = useMemo(
    () => unique(baseProducts.flatMap((p) => p.variants.map((v) => v.size))),
    [baseProducts],
  );
  const colors = useMemo(
    () => unique(baseProducts.flatMap((p) => p.variants.map((v) => v.color))),
    [baseProducts],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = gelToMinor(minPrice);
    const max = gelToMinor(maxPrice);
    const needsVariantFilter = Boolean(size || color || inStock);

    return [...baseProducts]
      .filter((p) => {
        if (q) {
          const searchable = [
            p.name,
            p.description,
            p.category,
            ...p.variants.flatMap((v) => [v.sku, v.size, v.color]),
          ]
            .join(" ")
            .toLowerCase();
          if (!searchable.includes(q)) return false;
        }
        if (min !== null && p.price < min) return false;
        if (max !== null && p.price > max) return false;
        if (
          needsVariantFilter &&
          !p.variants.some(
            (v) =>
              (!size || v.size === size) &&
              (!color || v.color === color) &&
              (!inStock || v.stock > 0),
          )
        )
          return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === "low") return a.price - b.price;
        if (sort === "high") return b.price - a.price;
        if (sort === "newest")
          return Date.parse(b.createdAt) - Date.parse(a.createdAt);
        return Number(b.featured) - Number(a.featured);
      });
  }, [baseProducts, query, minPrice, maxPrice, size, color, inStock, sort]);

  const filterCount = [size, color, minPrice, maxPrice].filter(Boolean).length + Number(inStock);
  const activeLabels = [
    size ? `SIZE ${size}` : "",
    color ? color.toUpperCase() : "",
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

  const hasAnyControl = Boolean(query || filterCount || sort !== "featured" || (!lockedCategory && category !== "All"));

  return (
    <>
      <div className={styles.toolbar}>
        {!lockedCategory ? (
          <div className="category-filters" aria-label="Filter products by category">
            {["All", ...categories.map((c) => c.name)].map((c) => (
              <button
                className={category === c ? "active" : ""}
                aria-pressed={category === c}
                key={c}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        ) : null}

        <div className={styles.searchRow}>
          <div>
            <label htmlFor="catalog-search" className="sr-only">Search products</label>
            <input
              id="catalog-search"
              type="search"
              placeholder="Search products, colours, sizes or SKU"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div>
            <label className="sr-only" htmlFor="catalog-sort">Sort products</label>
            <select id="catalog-sort" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="featured">Featured</option>
              <option value="newest">Newest</option>
              <option value="low">Price: low to high</option>
              <option value="high">Price: high to low</option>
            </select>
          </div>
        </div>

        <details className={styles.filterPanel}>
          <summary className={styles.filterSummary}>
            <span>FILTERS</span>
            <span className={styles.filterCount}>{filterCount}</span>
          </summary>
          <div className={styles.filterBody}>
            <div className={styles.field}>
              <label htmlFor="filter-size">Size</label>
              <select id="filter-size" value={size} onChange={(e) => setSize(e.target.value)}>
                <option value="">All sizes</option>
                {sizes.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="filter-color">Color</label>
              <select id="filter-color" value={color} onChange={(e) => setColor(e.target.value)}>
                <option value="">All colors</option>
                {colors.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>

            <div className={styles.field}>
              <label>Price range · GEL</label>
              <div className={styles.priceFields}>
                <input
                  aria-label="Minimum price in GEL"
                  inputMode="decimal"
                  placeholder="Min"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
                <input
                  aria-label="Maximum price in GEL"
                  inputMode="decimal"
                  placeholder="Max"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
            </div>

            <label className={styles.stockToggle}>
              <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />
              IN STOCK ONLY
            </label>

            <button
              type="button"
              className={styles.clearButton}
              disabled={!hasAnyControl}
              onClick={clearAll}
            >
              CLEAR ALL
            </button>
          </div>
        </details>
      </div>

      <div className={styles.resultMeta} role="status" aria-live="polite">
        <p className="eyebrow">{visible.length} PIECES</p>
        {activeLabels.length ? (
          <p className={styles.activeSummary}>{activeLabels.join(" · ")}</p>
        ) : null}
      </div>

      <div className="product-grid">
        {visible.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>
      {visible.length === 0 && (
        <div className="empty-state">
          <h2>No matching pieces.</h2>
          <p>Try clearing a filter, changing the price range or using another search.</p>
          {hasAnyControl ? (
            <button type="button" className="button secondary" onClick={clearAll}>CLEAR FILTERS</button>
          ) : null}
        </div>
      )}
    </>
  );
}
