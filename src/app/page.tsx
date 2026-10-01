import Image from "next/image";
import Link from "next/link";
import { pageMetadata } from "@/lib/site";
import { campaignImage, money } from "@/lib/catalog";
import { getHomepageCatalog } from "@/lib/catalog/repository";
import { CatalogNotice } from "@/components/catalog-notice";
import { Newsletter } from "@/components/newsletter";
import { HomeMotion } from "@/components/home-motion";
import { IntroDeviceShowcase } from "@/components/intro-device-showcase";
import styles from "./home.module.css";
import introScroll from "./intro-scroll.module.css";

export const metadata = pageMetadata("KULTURA — Step Into Kultura", "/");

const FALLBACK_SOCIAL = "/contact";

export default async function Home() {
  const { products: showcase, categories, status } = await getHomepageCatalog();
  const instagramUrl = process.env.NEXT_PUBLIC_INSTAGRAM_URL?.trim() || FALLBACK_SOCIAL;
  const facebookUrl = process.env.NEXT_PUBLIC_FACEBOOK_URL?.trim() || FALLBACK_SOCIAL;
  const heroProduct = showcase[0] ?? null;
  const studioProduct = showcase[1] ?? heroProduct;
  const orbitProduct = showcase[2] ?? heroProduct;
  const orbitCards = Array.from({ length: 6 }, (_, index) =>
    showcase[index % Math.max(showcase.length, 1)] ?? null,
  );
  const drifts = [
    [-55, -90, -8],
    [70, -48, 7],
    [-78, 54, 5],
    [62, 82, -5],
    [-26, 108, 9],
    [86, 28, -7],
  ];

  const categoryCards = categories.map((category, index) => {
    const product =
      showcase.find((item) => item.categorySlug === category.slug) ??
      showcase[index % Math.max(showcase.length, 1)] ??
      null;
    return {
      ...category,
      image: product?.image ?? campaignImage,
      alt: product?.images[0]?.alt ?? `${category.name} by KULTURA`,
      productName: product?.name ?? category.name,
    };
  });

  return (
    <HomeMotion className={styles.home}>
      <section className={`${styles.introScene} ${introScroll.journey}`} data-intro-scene>
        <div className={styles.sceneNav} data-scene-nav>
          <Link href="/" className={styles.brandPill} aria-label="KULTURA home">
            <span aria-hidden="true">✳</span>
            KULTURA
          </Link>
          <Link href="/shop" className={styles.shopPill}>SHOP KULTURA ↗</Link>
        </div>

        <div className={styles.introGlow} aria-hidden="true" />
        <div className={`${styles.introCenter} ${introScroll.copySticky}`} data-intro-copy>
          <p className={styles.introEyebrow}>STREETWEAR / GEORGIA</p>
          <h1 className={styles.introTitle} data-intro-title>
            <span>STEP INTO</span>
            <span>KULTURA</span>
          </h1>
          <p className={styles.introLead}>
            Clothing with presence. A visual language built around movement,
            proportion and the people wearing it.
          </p>
          <div className={styles.socialLinks}>
            <a href={instagramUrl} target={instagramUrl.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
              INSTAGRAM ↗
            </a>
            <a href={facebookUrl} target={facebookUrl.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
              FACEBOOK ↗
            </a>
          </div>
        </div>

        <IntroDeviceShowcase
          productImage={heroProduct?.image ?? "/images/hoodie.jpg"}
          productName={heroProduct?.name ?? "KULTURA HOODIE"}
          productHref={heroProduct ? `/product/${heroProduct.slug}` : "/shop"}
        />

        <div className={`${styles.introFooter} ${introScroll.footer}`}>
          <span>SCROLL TO ENTER</span>
          <span>001 / 2026</span>
          <span>GEORGIA / GEL</span>
        </div>
      </section>

      <section className={`${styles.studioScene} ${introScroll.skipStudio}`} data-studio-scene>
        <div className={styles.studioSticky}>
          <div className={styles.sceneNav}>
            <Link href="/" className={`${styles.brandPill} ${styles.brandPillLight}`}>
              <span aria-hidden="true">✳</span>
              KULTURA
            </Link>
            <Link href="/shop" className={`${styles.shopPill} ${styles.shopPillLight}`}>SHOP ↗</Link>
          </div>

          <div className={styles.studioBackdrop} data-studio-backdrop>
            <Image
              src={campaignImage}
              alt="KULTURA campaign workspace"
              fill
              sizes="100vw"
              priority={false}
            />
          </div>
          <div className={styles.studioTint} />
          <div className={styles.studioGrid} aria-hidden="true" />

          <div className={styles.studioCaption} data-studio-caption>
            <span>FROM IDEA</span>
            <span>TO GARMENT</span>
          </div>

          <article className={styles.generatorCard} data-generator-card>
            <div className={styles.generatorHeader}>
              <span>PRODUCT / 001</span>
              <span>LIVE CONCEPT</span>
            </div>
            <div className={styles.generatorPrompt}>
              <small>PRODUCT DIRECTION</small>
              <p>
                Build a piece that feels unmistakably KULTURA — strong silhouette,
                restrained detail, made to move.
              </p>
            </div>
            <div className={styles.generatorVisual}>
              <Image
                src={studioProduct?.image ?? campaignImage}
                alt={studioProduct?.images[0]?.alt ?? "KULTURA product"}
                fill
                sizes="(max-width: 700px) 78vw, 32vw"
              />
              <span className={styles.generatorFrame} aria-hidden="true" />
            </div>
            <div className={styles.generatorMeta}>
              <div>
                <small>CURRENT PIECE</small>
                <strong>{studioProduct?.name?.replace("KULTURA ", "") ?? "KULTURA 001"}</strong>
              </div>
              <div>
                <small>PRICE</small>
                <strong>{studioProduct ? money(studioProduct.price) : "—"}</strong>
              </div>
            </div>
            <Link href={studioProduct ? `/product/${studioProduct.slug}` : "/shop"} className={styles.slideCta}>
              <span className={styles.slideKnob} data-slide-knob aria-hidden="true">→</span>
              <span>STEP INTO KULTURA</span>
            </Link>
          </article>
        </div>
      </section>

      <section className={styles.orbitScene} data-orbit-scene>
        <div className={styles.orbitSticky}>
          <div className={styles.sceneNav}>
            <Link href="/" className={styles.brandPill}>
              <span aria-hidden="true">✳</span>
              KULTURA
            </Link>
            <Link href="/shop" className={styles.shopPill}>SHOP ↗</Link>
          </div>

          <div className={styles.dotField} aria-hidden="true" />
          <div className={styles.orbitCopy} data-orbit-copy>
            <span>002 / THE KULTURA UNIVERSE</span>
            <h2>ONE LANGUAGE.<br />DIFFERENT PIECES.</h2>
          </div>

          <Link
            href={orbitProduct ? `/product/${orbitProduct.slug}` : "/shop"}
            className={styles.orbitHero}
            data-orbit-hero
          >
            <Image
              src={orbitProduct?.image ?? campaignImage}
              alt={orbitProduct?.images[0]?.alt ?? "KULTURA hero product"}
              fill
              sizes="(max-width: 700px) 58vw, 25vw"
            />
            <span>
              {orbitProduct?.name?.replace("KULTURA ", "") ?? "KULTURA"}
              <small>VIEW PIECE ↗</small>
            </span>
          </Link>

          <div className={styles.floatingField} aria-hidden={!showcase.length}>
            {orbitCards.map((product, index) => (
              <Link
                href={product ? `/product/${product.slug}` : "/shop"}
                className={`${styles.floatCard} ${styles[`float${index + 1}`]}`}
                key={`${product?.id ?? "fallback"}-${index}`}
                data-float-card
                data-drift-x={drifts[index][0]}
                data-drift-y={drifts[index][1]}
                data-drift-r={drifts[index][2]}
              >
                <Image
                  src={product?.image ?? campaignImage}
                  alt={product?.images[0]?.alt ?? "KULTURA editorial"}
                  fill
                  sizes="(max-width: 700px) 34vw, 16vw"
                />
                <span>{product?.name?.replace("KULTURA ", "") ?? `KULTURA 0${index + 1}`}</span>
              </Link>
            ))}
          </div>

          <p className={styles.orbitNote}>SCROLL / EVERYTHING FINDS ITS PLACE</p>
        </div>
      </section>

      <section className={styles.bothSection} data-both-section>
        <div className={styles.bothHeader} data-reveal>
          <p>003 / CHOOSE YOUR ENTRY POINT</p>
          <h2>
            FASHION OR<br />
            KULTURA? <em>BOTH.</em>
          </h2>
          <p className={styles.bothLead}>
            Different categories, one attitude. Enter through the piece that feels
            most like you.
          </p>
          <Link href="/shop" className={styles.blackPill}>SHOP ALL ↗</Link>
        </div>

        <CatalogNotice status={status} empty={!showcase.length && !categories.length} />

        <div className={styles.categoryMasonry}>
          {categoryCards.map((category, index) => (
            <Link
              href={`/shop/${category.slug}`}
              className={styles.categoryTile}
              key={category.slug}
              data-category-card
              data-reveal
            >
              <Image src={category.image} alt={category.alt} fill sizes="(max-width: 720px) 92vw, 24vw" />
              <span className={styles.categoryShade} />
              <span className={styles.categoryIndex}>0{index + 1}</span>
              <div className={styles.categoryInfo}>
                <span>{category.name.toUpperCase()}</span>
                <small>{category.productName.replace("KULTURA ", "")}</small>
              </div>
              <span className={styles.categoryArrow}>↗</span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.finalScene}>
        <div className={styles.finalMedia}>
          <Image src={heroProduct?.image ?? campaignImage} alt="" fill sizes="100vw" />
        </div>
        <div className={styles.finalShade} />
        <div className={styles.finalContent} data-reveal>
          <span>004 / NO UNIFORM THINKING</span>
          <h2>MAKE IT<br />YOUR KULTURA.</h2>
          <div className={styles.finalActions}>
            <Link href="/shop">SHOP KULTURA ↗</Link>
            <Link href="/about">OUR STORY ↗</Link>
          </div>
        </div>
      </section>

      <Newsletter />
    </HomeMotion>
  );
}
