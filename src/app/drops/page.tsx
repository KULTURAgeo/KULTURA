import type { Metadata } from "next";
import {pageMetadata} from "@/lib/site";
import { Container } from "@/components/ui";
import { ProductCard } from "@/components/product-card";
import { getCatalog } from "@/lib/catalog/repository";
import { CatalogNotice } from "@/components/catalog-notice";
export const dynamic = "force-dynamic";
export const metadata: Metadata = pageMetadata("Drop 001", "/drops");
export default async function Drops() {
  const { products, status } = await getCatalog();
  return (
    <Container className="page-section">
      <p className="eyebrow">THE FIRST CHAPTER / PREVIEW</p>
      <h1 className="page-title">
        DROP <span className="chrome">001</span>
      </h1>
      <p>After hours. Beyond the ordinary.</p>
      <CatalogNotice status={status} empty={!products.some((p) => p.drop)} />
      <div className="product-grid section">
        {products
          .filter((p) => p.drop)
          .map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
      </div>
    </Container>
  );
}
