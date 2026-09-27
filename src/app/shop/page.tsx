import type { Metadata } from "next";
import {pageMetadata} from "@/lib/site";
import { Container } from "@/components/ui";
import { CatalogGrid } from "@/components/catalog-grid";
import { getCatalog } from "@/lib/catalog/repository";
import { CatalogNotice } from "@/components/catalog-notice";
export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMetadata("Shop", "/shop");
export default async function Shop() {
  const { products, categories, status } = await getCatalog();
  return (
    <Container className="page-section">
      <p className="eyebrow">THE KULTURA UNIFORM</p>
      <h1 className="page-title">
        ALL PIECES
        <span className="chrome">
          {" "}
          / {String(products.length).padStart(3, "0")}
        </span>
      </h1>
      <p className="muted">
        A preview of the collection. Ordering opens later.
      </p>
      {status === "ready" ? (
        <CatalogGrid products={products} categories={categories} />
      ) : (
        <CatalogNotice status={status} />
      )}
    </Container>
  );
}
