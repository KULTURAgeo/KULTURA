import Image from "next/image";
import {pageMetadata} from "@/lib/site";
export const metadata = pageMetadata("KULTURA — Step Into Kultura", "/");
import Link from "next/link";
import { campaignImage } from "@/lib/catalog";
import { getCatalog } from "@/lib/catalog/repository";
import { CatalogNotice } from "@/components/catalog-notice";
export const dynamic = "force-dynamic";
import { Container, SectionHeading, ButtonLink } from "@/components/ui";
import { ProductCard } from "@/components/product-card";
import { Newsletter } from "@/components/newsletter";
export default async function Home() {
  const { products, categories, status } = await getCatalog();
  return (
    <>
      <section className="hero">
        <Image
          src={campaignImage}
          alt="Black streetwear silhouette in a raw concrete urban setting"
          fill
          priority
          sizes="100vw"
        />
        <div className="hero-shade" />
        <div className="hero-top">
          <span>INDEPENDENT STREETWEAR</span>
          <span>COLLECTION 001 / 2026</span>
        </div>
        <div className="hero-content">
          <p className="eyebrow">STEP INTO KULTURA</p>
          <h1 className="chrome">KULTURA</h1>
          <div className="hero-bottom">
            <p>
              Made for the outside.
              <br />
              Worn on your own terms.
            </p>
            <ButtonLink href="/shop">
              SHOP NOW <span aria-hidden="true">↗</span>
            </ButtonLink>
          </div>
        </div>
        <span className="hero-caption">01 — THE EVERYDAY UNIFORM</span>
      </section>
      <div className="ticker" aria-hidden="true">
        <span>INDEPENDENT SPIRIT</span>
        <span>✳</span>
        <span>NO UNIFORM THINKING</span>
        <span>✳</span>
        <span>STEP INTO KULTURA</span>
        <span>✳</span>
      </div>
      <Container>
        <section className="section">
          <SectionHeading
            eyebrow="001 / THE FIRST CHAPTER"
            title="LATEST DROP"
            href="/drops"
            link="View the drop"
          />
          <div className="drop-panel">
            <div>
              <span className="chrome drop-number">001</span>
              <p className="eyebrow">A NEW WAY TO MOVE</p>
            </div>
            <div>
              <h3>
                AFTER HOURS.
                <br />
                BEYOND THE ORDINARY.
              </h3>
              <p>
                Heavy layers. Uncompromising silhouettes.
                <br />
                Your new everyday uniform.
              </p>
              <ButtonLink href="/drops" secondary>
                EXPLORE DROP 001 ↗
              </ButtonLink>
            </div>
          </div>
        </section>
        <section className="section">
          <SectionHeading
            eyebrow="THE ROTATION"
            title="SELECTED PIECES"
            href="/shop"
            link="Shop all"
          />
          <CatalogNotice status={status} empty={!products.some(p => p.featured)} />
          <div className="product-grid">
            {products
              .filter((p) => p.featured)
              .map((product) => (
                <ProductCard product={product} key={product.slug} />
              ))}
          </div>
        </section>
      </Container>
      <section className="editorial">
        <Image
          src={campaignImage}
          alt="Underground streetwear campaign, concrete and shadow"
          fill
          sizes="100vw"
        />
        <div className="editorial-copy">
          <p className="eyebrow">KULTURA / CAMPAIGN 001</p>
          <h2>
            NOT FOR
            <br />
            EVERYONE.
            <br />
            <span>FOR YOU.</span>
          </h2>
          <Link className="text-link" href="/about">
            The KULTURA state of mind ↗
          </Link>
        </div>
        <span className="editorial-note">OUTSIDE THE EXPECTED.</span>
      </section>
      <Container>
        <section className="section">
          <SectionHeading
            eyebrow="FIND YOUR UNIFORM"
            title="SHOP BY CATEGORY"
          />
          <div className="category-grid">
            {categories.map((category, i) => (
              <Link key={category.slug} href={`/shop/${category.slug}`}>
                <span className="eyebrow">0{i + 1}</span>
                <h3>{category.name}</h3>
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </section>
        <section className="brand-statement">
          <span className="chrome star" aria-hidden="true">
            ✳
          </span>
          <p>
            Clothing is a language.
            <br />
            Ours speaks for itself.
          </p>
          <Link href="/about" className="text-link">
            THIS IS KULTURA ↗
          </Link>
        </section>
      </Container>
      <Newsletter />
    </>
  );
}
