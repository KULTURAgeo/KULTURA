import { notFound } from "next/navigation";
import { isShopDivision } from "@/lib/catalog/divisions";
import { pageMetadata } from "@/lib/site";
import { isSearchIndexableCategorySlug } from "@/lib/seo-indexing";
import { Container } from "@/components/ui";
import { CatalogGrid } from "@/components/catalog-grid";
import { LocalizedLabel } from "@/components/localized-label";
import { LocalizedCategoryName } from "@/components/localized-category-name";
import { CatalogNotice } from "@/components/catalog-notice";
import {
  getCategoryCatalog,
  getShopDivision,
} from "@/lib/catalog/repository";

export const dynamic = "force-dynamic";



export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const result = isShopDivision(category) ? null : await getCategoryCatalog(category);
  const metadata = pageMetadata(
    isShopDivision(category) ? category.toUpperCase() : (result?.category?.name ?? "Category unavailable"),
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
  if (isShopDivision(category)) {
    const { products, status } = await getShopDivision(category);
    return (
      <Container className="page-section">
        <p className="eyebrow"><LocalizedLabel source="THE COLLECTION" /></p>
        <h1 className="page-title">{category.toUpperCase()}</h1>
        {status !== "ready" ? <CatalogNotice status={status} /> : (
          <CatalogGrid products={products} categories={[]} />
        )}
      </Container>
    );
  }
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
      <p className="eyebrow"><LocalizedLabel source="THE COLLECTION" /></p>
      <h1 className="page-title"><LocalizedCategoryName name={selected.name} slug={selected.slug} /></h1>
      <CatalogGrid
        products={products}
        categories={[]}
        initialCategory={selected.name}
      />
    </Container>
  );
}
