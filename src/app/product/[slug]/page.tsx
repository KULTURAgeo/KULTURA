import Link from "next/link";
import { pageMetadata, siteUrl } from "@/lib/site";
import { isSearchIndexableProductSlug } from "@/lib/seo-indexing";
import { notFound } from "next/navigation";
import {
  getCachedProductBySlug,
  getRelatedProducts,
} from "@/lib/catalog/repository";
import { getActiveProductSlugs } from "@/lib/catalog/static-params";
import { CatalogNotice } from "@/components/catalog-notice";
import { Container, SectionHeading } from "@/components/ui";
import { ProductDetail } from "@/components/product-detail";
import { ProductCard } from "@/components/product-card";
import { StructuredData } from "@/components/structured-data";
import { RecentlyViewed } from "@/components/recently-viewed";
import { LocalizedLabel } from "@/components/localized-label";

export const revalidate = 300;

export async function generateStaticParams() {
  const slugs = await getActiveProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { product: p } = await getCachedProductBySlug(slug);
  const metadata = pageMetadata(
    p?.seoTitle ?? p?.name ?? "Product unavailable",
    "/product/" + slug,
    p?.seoDescription ?? p?.description,
  );
  if (p)
    metadata.openGraph = {
      ...metadata.openGraph,
      images: [{ url: p.image, alt: p.name }],
    };

  if (!p || !isSearchIndexableProductSlug(slug)) {
    metadata.robots = { index: false, follow: false };
  }

  return metadata;
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { product, status } = await getCachedProductBySlug(slug);
  if (status !== "ready")
    return (
      <Container className="page-section">
        <CatalogNotice status={status} />
      </Container>
    );
  if (!product) notFound();

  const origin = siteUrl();
  const productUrl = new URL("/product/" + product.slug, origin).href;
  const inStock = product.variants.some((variant) => variant.stock > 0);
  const images = product.images.length
    ? product.images.map((image) => new URL(image.src, origin).href)
    : [new URL(product.image, origin).href];

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description: product.seoDescription ?? product.description,
      image: images,
      url: productUrl,
      sku: product.variants[0]?.sku,
      brand: {
        "@type": "Brand",
        name: "KULTURA",
      },
      offers: {
        "@type": "Offer",
        url: productUrl,
        priceCurrency: "GEL",
        price: (product.price / 100).toFixed(2),
        availability: inStock
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
        itemCondition: "https://schema.org/NewCondition",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "KULTURA",
          item: origin.href,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Shop",
          item: new URL("/shop", origin).href,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: product.name,
          item: productUrl,
        },
      ],
    },
  ];

  const related = await getRelatedProducts(
    product.categorySlug,
    product.slug,
    4,
  );

  return (
    <>
      {isSearchIndexableProductSlug(product.slug) ? (
        <StructuredData data={structuredData} />
      ) : null}
      <Container className="page-section">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/shop"><LocalizedLabel source="SHOP" /></Link>
          <span>/</span>
          <Link href={`/shop/${product.categorySlug}`}>
            {product.category.toUpperCase()}
          </Link>
          <span>/</span>
          <span>{product.name.replace("KULTURA ", "")}</span>
        </nav>
        <ProductDetail key={product.slug} product={product} />
        {related.length ? (
          <section className="section">
            <SectionHeading eyebrow="RELATED PIECES" title="YOU MAY ALSO LIKE" />
            <div className="product-grid">
              {related.map((item) => (
                <ProductCard key={item.slug} product={item} />
              ))}
            </div>
          </section>
        ) : null}
        <RecentlyViewed product={product} />
      </Container>
    </>
  );
}
