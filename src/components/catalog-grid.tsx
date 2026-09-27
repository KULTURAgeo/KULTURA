"use client";
import { useState } from "react";
import type { Product, Category } from "@/lib/catalog";
import { ProductCard } from "./product-card";
export function CatalogGrid({
  products,
  categories,
  initialCategory = "All",
}: {
  products: Product[];
  categories: Category[];
  initialCategory?: string;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("featured");
  const visible = products
    .filter(
      (p) =>
        (category === "All" || p.category === category) &&
        p.name.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "low"
        ? a.price - b.price
        : sort === "high"
          ? b.price - a.price
          : Number(b.featured) - Number(a.featured),
    );
  return (
    <>
      <div className="catalog-controls">
        <div className="category-filters" aria-label="Filter products">
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
        <div className="search-sort">
          <label htmlFor="search" className="sr-only">
            Search products
          </label>
          <input
            id="search"
            type="search"
            placeholder="Search the collection"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <label className="sr-only" htmlFor="sort">
            Sort products
          </label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="featured">Featured</option>
            <option value="low">Price: low to high</option>
            <option value="high">Price: high to low</option>
          </select>
        </div>
      </div>
      <p className="eyebrow" role="status">
        {visible.length} PIECES
      </p>
      <div className="product-grid">
        {visible.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>
      {visible.length === 0 && (
        <p className="empty-state">
          {products.length === 0
            ? "New pieces are on the way. Check back soon."
            : "No pieces match. Try another search or category."}
        </p>
      )}
    </>
  );
}
