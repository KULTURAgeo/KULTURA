import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { Container } from "@/components/ui";
import { ProductCard } from "@/components/product-card";
import { getDropProducts } from "@/lib/catalog/repository";
import { CatalogNotice } from "@/components/catalog-notice";
import { getServerLocale } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";

export const metadata: Metadata = pageMetadata("Drop 001", "/drops");

export default async function Drops() {
  const locale = await getServerLocale();
  const t = (source: string) => translate(locale, source);
  const { products, status } = await getDropProducts();
  return (
    <Container className="page-section">
      <p className="eyebrow">{t("THE FIRST CHAPTER / PREVIEW")}</p>
      <h1 className="page-title">
        DROP <span className="chrome">001</span>
      </h1>
      <p>{t("After hours. Beyond the ordinary.")}</p>
      <CatalogNotice status={status} empty={!products.length} />
      <div className="product-grid section">
        {products.map((product) => (
          <ProductCard key={product.slug} product={product} />
        ))}
      </div>
    </Container>
  );
}
