export const dynamic = "force-dynamic";
import Link from "next/link";
import {pageMetadata} from "@/lib/site";
import { notFound } from "next/navigation";
import { getCatalog, getProductBySlug } from "@/lib/catalog/repository";
import { CatalogNotice } from "@/components/catalog-notice";
import { Container, SectionHeading } from "@/components/ui";
import { ProductDetail } from "@/components/product-detail";
import { ProductCard } from "@/components/product-card";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { product: p } = await getProductBySlug(slug);
  const metadata = pageMetadata(p?.seoTitle ?? p?.name ?? "Product unavailable", "/product/"+slug, p?.seoDescription ?? p?.description);
  if (p) metadata.openGraph = {...metadata.openGraph, images: [{url:p.image, alt:p.name}]};
  else metadata.robots = {index:false,follow:false};
  return metadata;
}
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { product, status } = await getProductBySlug(slug);
  if (status !== "ready")
    return (
      <Container className="page-section">
        <CatalogNotice status={status} />
      </Container>
    );
  if (!product) notFound();
  const { products } = await getCatalog();
  return (
    <Container className="page-section">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/shop">SHOP</Link>
        <span>/</span>
        <span>{product.name.replace("KULTURA ", "")}</span>
      </nav>
      <ProductDetail key={product.slug} product={product} />
      <section className="section">
        <SectionHeading
          eyebrow="COMPLETE THE ROTATION"
          title="GOES WITH YOUR ENERGY"
        />
        <div className="product-grid">
          {products
            .filter((p) => p.slug !== slug)
            .slice(0,4)
            .map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
        </div>
      </section>
    </Container>
  );
}
