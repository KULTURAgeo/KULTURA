import Image from "next/image";
import Link from "next/link";
import { pageMetadata } from "@/lib/site";
import { campaignImage, money } from "@/lib/catalog";
import { getHomepageCatalog } from "@/lib/catalog/repository";
import { CatalogNotice } from "@/components/catalog-notice";
import { Newsletter } from "@/components/newsletter";
import { HomeMotion } from "@/components/home-motion";
import styles from "./home.module.css";

export const metadata = pageMetadata("KULTURA — Step Into Kultura", "/");

const FALLBACK_SOCIAL = "/contact";

export default async function Home() {
  const { products: showcase, categories, status } = await getHomepageCatalog();
  const instagramUrl = process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim() || FALLBACK_SOCIAL;
  const facebookUrl = process.env.NEXT_PUBLIC_FACEBOOK_URL?.trim() || FALLBACK_SOCIAL;

  const heroProduct = showcase[0] ?? null;
  const secondProduct = showcase[1] ?? heroProduct;
  const thirdProduct = showcase[2] ?? secondProduct ?? heroProduct;

  const phoneSlides = [heroProduct, secondProduct, thirdProduct];
  const floatProducts = Array.from({ length: 6 }, (_, index) =>
    showcase[index % Math.max(showcase.length, 1)] ?? null,
  );

  const categoryTiles = categories.map((category, index) => {
    const product =
      showcase.find((item) => item.categorySlug === category.slug) ??
      showcase[index % Math.max(showcase.length, 1)] ??
      null;
    return {
      ...category,
      image: product?.image ?? campaignImage,
      alt: product?.images[0]?.alt ?? `${category.name} by KULTURA`,
    };
  });

  return (
    <HomeMotion className={styles.home}>
      <section className={styles.hero} data-hero>
        <div className={styles.heroInner} data-hero-copy>
          <p className={styles.eyebrow}>INDEPENDENT STREETWEAR / GEORGIA</p>
          <h1>STEP INTO KULTURA</h1>
          <p className={styles.heroLead}>
            Clothing with presence. Strong silhouettes, restrained detail and movement at the center.
          </p>
          <div className={styles.socials}>
            <a href={instagramUrl} target={instagramUrl.startsWith("http") ? "_blank" : undefined} rel="noreferrer">INSTAGRAM ↗</a>
            <a href={facebookUrl} target={facebookUrl.startsWith("http") ? "_blank" : undefined} rel="noreferrer">FACEBOOK ↗</a>
          </div>
        </div>

        <div className={styles.heroPeek} aria-hidden="true">
          <Image src={campaignImage} alt="" fill priority sizes="100vw" />
          <span className={styles.heroPeekGrid} />
          <span className={styles.heroPeekWord}>KULTURA</span>
        </div>
      </section>

      <section className={styles.demoTrack} data-demo-track>
        <div className={styles.demoSticky}>
          <div className={styles.demoBackdrop} data-demo-backdrop>
            <Image src={campaignImage} alt="" fill sizes="100vw" />
            <div className={styles.demoShade} />
            <div className={styles.demoGrid} />
            <div className={styles.demoLogoField} aria-hidden="true">KULTURA</div>
          </div>

          <div className={styles.phone} data-phone>
            <div className={styles.phoneFrame}>
              <div className={styles.phoneTop}>
                <span>9:41</span>
                <span className={styles.island} />
                <span>5G ◒</span>
              </div>
              <div className={styles.phoneHeader}>
                <strong>KULTURA</strong>
                <span>K</span>
              </div>
              <div className={styles.phoneLabel}>FEATURED / DROP 001</div>

              <div className={styles.phoneViewport}>
                {phoneSlides.map((product, index) => (
                  <div
                    className={styles.phoneSlide}
                    data-phone-slide
                    data-index={index}
                    key={`${product?.id ?? "fallback"}-${index}`}
                  >
                    <Image
                      src={product?.image ?? campaignImage}
                      alt={product?.images[0]?.alt ?? "KULTURA product"}
                      fill
                      sizes="260px"
                    />
                    <div className={styles.phoneSlideShade} />
                    <div className={styles.phoneMeta}>
                      <strong>{product?.name?.replace("KULTURA ", "") ?? `KULTURA 0${index + 1}`}</strong>
                      <span>{product ? money(product.price) : "VIEW"}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.phoneBottom}>
                <span>HOME</span>
                <span>SHOP</span>
                <span>01</span>
              </div>
            </div>
          </div>

          <div
            data-phone-bridge
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "50%",
              top: "65%",
              width: "min(540px, 56vw)",
              height: "156px",
              transform: "translate(-50%, -50%) scale(.86)",
              borderRadius: "28px",
              overflow: "hidden",
              backgroundColor: "#171717",
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,.62) 1.1px, transparent 1.3px)",
              backgroundSize: "44px 44px",
              boxShadow: "0 26px 70px rgba(0,0,0,.38)",
              zIndex: 8,
              opacity: 0,
              pointerEvents: "none",
              willChange: "transform,width,height,top,border-radius,opacity",
            }}
          >
            <div
              data-bridge-cta
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: "min(335px, 64%)",
                height: "56px",
                transform: "translate(-50%, -50%)",
                borderRadius: "14px",
                display: "grid",
                placeItems: "center",
                background: "#d8f300",
                color: "#111",
                fontSize: "10px",
                fontWeight: 900,
                letterSpacing: ".11em",
              }}
            >
              STEP INTO KULTURA
            </div>

            <div
              data-bridge-product
              style={{
                position: "absolute",
                left: "50%",
                top: "52%",
                width: "min(410px, 28vw)",
                aspectRatio: ".69",
                transform: "translate(-50%, -50%) scale(.72)",
                borderRadius: "24px",
                overflow: "hidden",
                opacity: 0,
                boxShadow: "0 24px 64px rgba(0,0,0,.34)",
              }}
            >
              <Image
                src={heroProduct?.image ?? campaignImage}
                alt=""
                fill
                sizes="(max-width: 720px) 55vw, 28vw"
                style={{ objectFit: "cover" }}
              />
            </div>
          </div>

          <div className={styles.demoCaption} data-demo-caption>
            <span>SCROLL TO EXPLORE</span>
            <span>PRODUCTS IN MOTION</span>
          </div>
        </div>
      </section>

      <section className={styles.orbitTrack} data-orbit-track>
        <div className={styles.orbitSticky}>
          <div className={styles.dotField} aria-hidden="true" />

          <div className={styles.orbitHeading} data-orbit-heading>
            <span>KULTURA / SELECTED PIECES</span>
            <h2>ONE LANGUAGE.<br />DIFFERENT PIECES.</h2>
          </div>

          <Link
            href={heroProduct ? `/product/${heroProduct.slug}` : "/shop"}
            className={styles.orbitCenter}
            data-orbit-center
          >
            <Image
              src={heroProduct?.image ?? campaignImage}
              alt={heroProduct?.images[0]?.alt ?? "KULTURA featured product"}
              fill
              sizes="(max-width: 720px) 55vw, 28vw"
            />
            <span>{heroProduct?.name?.replace("KULTURA ", "") ?? "KULTURA"}</span>
          </Link>

          {floatProducts.map((product, index) => (
            <Link
              href={product ? `/product/${product.slug}` : "/shop"}
              className={`${styles.floatCard} ${styles[`float${index + 1}`]}`}
              data-float
              data-index={index}
              key={`${product?.id ?? "float"}-${index}`}
            >
              <Image
                src={product?.image ?? campaignImage}
                alt={product?.images[0]?.alt ?? "KULTURA product"}
                fill
                sizes="(max-width: 720px) 30vw, 15vw"
              />
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.bothSection} data-reveal>
        <p className={styles.bothEyebrow}>KULTURA / CATEGORIES</p>
        <h2>FASHION OR KULTURA?<br /><em>BOTH.</em></h2>
        <p className={styles.bothLead}>Choose the piece. Keep the attitude.</p>
        <Link href="/shop" className={styles.cta}>SHOP KULTURA ↗</Link>
      </section>

      <section className={styles.gallerySection}>
        <CatalogNotice status={status} empty={!showcase.length && !categories.length} />
        <div className={styles.galleryGrid}>
          {categoryTiles.map((category, index) => (
            <Link
              href={`/shop/${category.slug}`}
              className={styles.galleryCard}
              data-gallery-card
              data-reveal
              key={category.slug}
            >
              <Image src={category.image} alt={category.alt} fill sizes="(max-width: 720px) 92vw, 25vw" />
              <span className={styles.galleryShade} />
              <span className={styles.galleryIndex}>0{index + 1}</span>
              <div className={styles.galleryCopy}>
                <strong>{category.name}</strong>
                <span>SHOP CATEGORY ↗</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.endScene}>
        <Image src={thirdProduct?.image ?? campaignImage} alt="" fill sizes="100vw" />
        <div className={styles.endShade} />
        <div className={styles.endCopy} data-reveal>
          <span>STEP INTO KULTURA</span>
          <h2>WEAR IT<br />YOUR WAY.</h2>
          <Link href="/shop" className={styles.endCta}>ENTER SHOP ↗</Link>
        </div>
      </section>

      <Newsletter />
    </HomeMotion>
  );
}
