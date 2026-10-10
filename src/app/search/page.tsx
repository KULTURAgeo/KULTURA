import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { CatalogGrid } from "@/components/catalog-grid";
import { CatalogNotice } from "@/components/catalog-notice";
import { LocalizedLabel } from "@/components/localized-label";
import { getCatalog } from "@/lib/catalog/repository";

export const metadata: Metadata = {
  title: "Search | KULTURA",
  robots: { index: false, follow: true },
};

export default async function SearchPage() {
  const { products, categories, status } = await getCatalog();
  return (
    <Container className="page-section">
      <p className="eyebrow">KULTURA / <LocalizedLabel source="SHOP" /></p>
      <h1 className="page-title"><LocalizedLabel source="Search products" /></h1>
      {status === "ready" ? (
        <CatalogGrid products={products} categories={categories} />
      ) : (
        <CatalogNotice status={status} />
      )}
    </Container>
  );
}
