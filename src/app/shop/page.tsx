import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { Container } from "@/components/ui";
import { getShopCategories } from "@/lib/catalog/repository";
import { CatalogNotice } from "@/components/catalog-notice";

export const metadata: Metadata = pageMetadata("Shop", "/shop");

export default async function Shop() {
  const { categories, status } = await getShopCategories();

  return (
    <Container className="page-section">
      <p className="eyebrow">THE KULTURA UNIFORM</p>
      <h1 className="page-title">
        SHOP
        <span className="chrome">
          {" "}
          / {String(categories.length).padStart(2, "0")}
        </span>
      </h1>
      <p className="muted">Choose a category to explore the collection.</p>

      {status !== "ready" ? (
        <CatalogNotice status={status} />
      ) : categories.length === 0 ? (
        <div className="empty-state">
          <h2>Categories are coming soon.</h2>
          <p>The shop will appear here once categories are activated.</p>
        </div>
      ) : (
        <div className="category-grid">
          {categories.map((category, index) => (
            <Link href={"/shop/" + category.slug} key={category.slug}>
              <span className="eyebrow">
                CATEGORY {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{category.name}</h3>
              <span className="muted">
                {category.count} {category.count === 1 ? "PIECE" : "PIECES"}
              </span>
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}
