import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { Container } from "@/components/ui";
import { ProductCard } from "@/components/product-card";
import { getDropProducts } from "@/lib/catalog/repository";
import { CatalogNotice } from "@/components/catalog-notice";

export const metadata: Metadata = pageMetadata("Drop 001", "/drops");

export default async function Drops() {
  const { products, status } = await getDropProducts();
  return (
    <Container className="page-section">
      <p className="eyebrow">THE FIRST CHAPTER / PREVIEW</p>
      <h1 className="page-title">
        DROP <span className="chrome">001</span>
      </h1>
      <p>After hours. Beyond the ordinary.</p>
      <CatalogNotice status={status} empty={!products.length} />
      <div className="product-grid section">
        {products.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </Container>
  );
}
