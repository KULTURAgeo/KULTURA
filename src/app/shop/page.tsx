import Link from "next/link";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site";
import { Container } from "@/components/ui";
import { getShopCategories } from "@/lib/catalog/repository";
import { CatalogNotice } from "@/components/catalog-notice";
import { getServerLocale } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";

export const metadata: Metadata = pageMetadata("Shop", "/shop");

export default async function Shop() {
  const locale = await getServerLocale();
  const t = (source: string) => translate(locale, source);
  const { categories, status } = await getShopCategories();

  return (
    <Container className="page-section">
      <p className="eyebrow">{t("THE KULTURA UNIFORM")}</p>
      <h1 className="page-title">
        {t("SHOP")}
        <span className="chrome">
          {" "}
          / {String(categories.length).padStart(2, "0")}
        </span>
      </h1>
      <p className="muted">{t("Choose a category to explore the collection.")}</p>

      {status !== "ready" ? (
        <CatalogNotice status={status} />
      ) : categories.length === 0 ? (
        <div className="empty-state">
          <h2>{t("Categories are coming soon.")}</h2>
          <p>{t("The shop will appear here once categories are activated.")}</p>
        </div>
      ) : (
        <div className="category-grid">
          {categories.map((category, index) => (
            <Link href={"/shop/" + category.slug} key={category.slug}>
              <span className="eyebrow">
                {t("CATEGORY")} {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{category.name}</h3>
              <span className="muted">
                {category.count} {t(category.count === 1 ? "PIECE" : "PIECES")}
              </span>
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}
