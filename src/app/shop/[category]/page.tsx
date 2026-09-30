import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/site";
import { isSearchIndexableCategorySlug } from "@/lib/seo-indexing";
import { Container } from "@/components/ui";
import { CatalogGrid } from "@/components/catalog-grid";
import { CatalogNotice } from "@/components/catalog-notice";
import {
  getCategoryCatalog,
  getShopCategories,
} from "@/lib/catalog/repository";

export const dynamic = "force-static";
export const revalidate = 300;

export async function generateStaticParams() {
  const { categories, status } = await getShopCategories();
  if (status !== "ready") return [];
  return categories.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const result = await getCategoryCatalog(category);
  const metadata = pageMetadata(
    result.category?.name ?? "Category unavailable",
    "/shop/" + category,
  );

  if (!isSearchIndexableCategorySlug(category)) {
    metadata.robots = { index: false, follow: false };
  }

  return metadata;
}

export default async function Category({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const { products, category: selected, status } =
    await getCategoryCatalog(category);
  if (status !== "ready")
    return (
      <Container className="page-section">
        <CatalogNotice status={status} />
      </Container>
    );

  if (!selected) notFound();

  return (
    <Container className="page-section">
      <p className="eyebrow">THE COLLECTION</p>
      <h1 className="page-title">{selected.name}</h1>
      <CatalogGrid
        products={products}
        categories={[]}
        initialCategory={selected.name}
      />
    </Container>
  );
}
