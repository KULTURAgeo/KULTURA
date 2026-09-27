export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import {pageMetadata} from "@/lib/site";
import { Container } from "@/components/ui";
import { CatalogGrid } from "@/components/catalog-grid";
import { CatalogNotice } from "@/components/catalog-notice";
import { getCatalog } from "@/lib/catalog/repository";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const { categories } = await getCatalog();
  return pageMetadata(categories.find(c => c.slug === category)?.name ?? "Category unavailable", "/shop/"+category);
}
export default async function Category({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const { products, categories, status } = await getCatalog();
  if (status !== "ready")
    return (
      <Container className="page-section">
        <CatalogNotice status={status} />
      </Container>
    );
  const selected = categories.find((c) => c.slug === category);
  if (!selected) notFound();
  return (
    <Container className="page-section">
      <p className="eyebrow">THE COLLECTION</p>
      <h1 className="page-title">{selected.name}</h1>
      <CatalogGrid
        products={products}
        categories={categories}
        initialCategory={selected.name}
      />
    </Container>
  );
}
