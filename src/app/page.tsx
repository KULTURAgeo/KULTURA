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

const INSTAGRAM_URL = "https://www.instagram.com/kultura.geo/";

function facebookProfileUrl(): string | undefined {
  const configured = process.env.NEXT_PUBLIC_FACEBOOK_URL?.trim();
  if (!configured) return undefined;
  try {
    const url = new URL(configured);
    if (
      url.protocol === "https:" &&
      ["facebook.com", "www.facebook.com", "m.facebook.com"].includes(url.hostname.toLowerCase())
    ) {
      return url.href;
    }
  } catch {
    // An unset or invalid profile URL must not redirect customers elsewhere.
  }
  return undefined;
}

export default async function Home() {
  const { products: showcase, categories, status } = await getHomepageCatalog();
  const facebookUrl = facebookProfileUrl();

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
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">INSTAGRAM ↗</a>
            <a
              href={facebookUrl}
              target={facebookUrl ? "_blank" : undefined}
              rel={facebookUrl ? "noopener noreferrer" : undefined}
              aria-disabled={!facebookUrl}
            >
              FACEBOOK ↗
            </a>
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

              <div
                className={styles.phoneBottom}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 64px 1fr",
                  alignItems: "center",
                  width: "100%",
                }}
              >
                <span style={{ justifySelf: "start" }}>HOME</span>
                <span
                  data-phone-logo
                  style={{
                    position: "relative",
                    width: 64,
                    height: 26,
                    justifySelf: "center",
                    display: "block",
                    borderRadius: 999,
                    overflow: "hidden",
                    background: "#000",
                    border: "1px solid rgba(0,0,0,.36)",
                    boxShadow: "0 3px 10px rgba(0,0,0,.22)",
                    transformOrigin: "center center",
                    willChange: "transform,opacity",
                  }}
                >
                  <Image
                    src="/images/kultura-globe-phone.webp"
                    alt="KULTURA globe logo"
                    fill
                    unoptimized
                    loading="eager"
                    sizes="64px"
                    style={{ objectFit: "contain", objectPosition: "center", padding: "1px 3px" }}
                  />
                </span>
                <span style={{ justifySelf: "end" }}>01</span>
              </div>
            </div>
          </div>

          <div
            data-phone-transition
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: "100vw",
              height: "100svh",
              transform: "translate(-50%, -50%)",
              overflow: "hidden",
              backgroundColor: "#030303",
              boxShadow: "0 26px 70px rgba(0,0,0,.4)",
              zIndex: 8,
              opacity: 0,
              pointerEvents: "none",
              willChange: "transform,clip-path,opacity",
            }}
          >
            <div
              data-scene-logo
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: "min(980px, 74vw)",
                aspectRatio: "1091 / 630",
                transform: "translate(-50%, -50%) scale(.72)",
                zIndex: 0,
                opacity: 0,
                willChange: "transform,opacity",
              }}
            >
              <Image
                src="/images/kultura-globe-scene.webp"
                alt=""
                fill
                unoptimized
                loading="eager"
                sizes="74vw"
                style={{ objectFit: "contain", objectPosition: "center" }}
              />
            </div>

            <div
              data-transition-scene
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 2,
                opacity: 0,
              }}
            >
              <div
                data-transition-center
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "52%",
                  width: "min(410px, 28vw)",
                  aspectRatio: ".69",
                  transform: "translate(-50%, -50%) scale(.8)",
                  borderRadius: "24px",
                  overflow: "hidden",
                  boxShadow: "0 24px 64px rgba(0,0,0,.48)",
                  zIndex: 5,
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

              {floatProducts.slice(0, 4).map((product, index) => (
                <div
                  data-transition-float
                  data-index={index}
                  key={`transition-${product?.id ?? index}`}
                  style={{
                    position: "absolute",
                    width: index % 2 ? "13vw" : "15vw",
                    maxWidth: index % 2 ? 190 : 230,
                    minWidth: 100,
                    aspectRatio: index % 2 ? "1 / 1" : ".78",
                    left: index === 0 ? "7%" : index === 2 ? "8%" : undefined,
                    right: index === 1 ? "9%" : index === 3 ? "7%" : undefined,
                    top: index < 2 ? "18%" : undefined,
                    bottom: index >= 2 ? "12%" : undefined,
                    borderRadius: 17,
                    overflow: "hidden",
                    opacity: 0,
                    transform: "scale(.74)",
                    boxShadow: "0 20px 52px rgba(0,0,0,.42)",
                    zIndex: 4,
                  }}
                >
                  <Image
                    src={product?.image ?? campaignImage}
                    alt=""
                    fill
                    sizes="15vw"
                    style={{ objectFit: "cover" }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className={styles.demoCaption} data-demo-caption>
            <span>SCROLL TO EXPLORE</span>
            <span>PRODUCTS IN MOTION</span>
          </div>
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
