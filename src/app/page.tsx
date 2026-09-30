import Image from "next/image";
import Link from "next/link";
import { pageMetadata } from "@/lib/site";
import { campaignImage, money } from "@/lib/catalog";
import { getHomepageCatalog } from "@/lib/catalog/repository";
import { CatalogNotice } from "@/components/catalog-notice";
import { ButtonLink } from "@/components/ui";
import { Newsletter } from "@/components/newsletter";
import { HomeMotion } from "@/components/home-motion";
import styles from "./home.module.css";

export const metadata = pageMetadata("KULTURA — Step Into Kultura", "/");

export default async function Home() {
  const { products: showcase, categories, status } = await getHomepageCatalog();

  const storyCards = [
    {
      number: "01",
      eyebrow: "FORM / SILHOUETTE",
      title: "BUILT TO HOLD ITS SHAPE.",
      copy: "Volume, proportion and structure before anything else.",
      image: showcase[0]?.image ?? campaignImage,
      alt: showcase[0]?.images[0]?.alt ?? "KULTURA streetwear silhouette",
      href: showcase[0] ? `/product/${showcase[0].slug}` : "/shop",
    },
    {
      number: "02",
      eyebrow: "DETAIL / TEXTURE",
      title: "CLOSE UP CHANGES EVERYTHING.",
      copy: "The pieces are designed to reward a second look.",
      image: showcase[1]?.image ?? campaignImage,
      alt: showcase[1]?.images[0]?.alt ?? "KULTURA garment detail",
      href: showcase[1] ? `/product/${showcase[1].slug}` : "/shop",
    },
    {
      number: "03",
      eyebrow: "MOVEMENT / EVERYDAY",
      title: "MADE FOR THE WAY YOU MOVE.",
      copy: "Streetwear that works in motion, not only in a still frame.",
      image: campaignImage,
      alt: "KULTURA campaign in a raw urban setting",
      href: "/drops",
    },
    {
      number: "04",
      eyebrow: "IDENTITY / KULTURA",
      title: "WEAR IT YOUR OWN WAY.",
      copy: "No uniform thinking. One language, different voices.",
      image: showcase[2]?.image ?? campaignImage,
      alt: showcase[2]?.images[0]?.alt ?? "KULTURA independent streetwear",
      href: showcase[2] ? `/product/${showcase[2].slug}` : "/about",
    },
  ];

  const editorialImages = [
    {
      src: campaignImage,
      alt: "KULTURA campaign editorial",
      label: "CAMPAIGN 001",
      note: "TBILISI / 2026",
    },
    {
      src: showcase[3]?.image ?? showcase[0]?.image ?? campaignImage,
      alt: showcase[3]?.images[0]?.alt ?? showcase[0]?.images[0]?.alt ?? "KULTURA product editorial",
      label: "THE ROTATION",
      note: showcase[3]?.name ?? showcase[0]?.name ?? "KULTURA",
    },
  ];

  return (
    <HomeMotion className={styles.home}>
      <section className={styles.hero} data-home-hero>
        <div className={styles.heroMedia} aria-hidden="true" data-home-media>
          <Image src={campaignImage} alt="" fill priority sizes="100vw" />
        </div>
        <div className={styles.heroShade} />
        <div className={styles.heroGrain} />
        <div className={styles.heroChromeOrb} aria-hidden="true" data-home-orb>✳</div>

        <div className={styles.heroMeta} data-home-intro>
          <span>KULTURA / INDEPENDENT STREETWEAR</span>
          <span>TBILISI — GEORGIA</span>
          <span>COLLECTION 001 / 2026</span>
        </div>

        <div className={styles.heroContent}>
          <p className={styles.heroKicker} data-home-intro>STEP INTO KULTURA / NEW ERA</p>
          <h1 className={styles.heroTitle} data-home-intro>KULTURA</h1>
          <div className={styles.heroFooter} data-home-intro>
            <p className={styles.heroLead}>
              Clothing with presence.<br />
              Built for movement, made to be yours.
            </p>
            <div className={styles.heroIndex} aria-hidden="true">
              <strong>001</strong>
              <span>FIRST CHAPTER</span>
            </div>
            <p className={styles.heroAside}>
              A darker, sharper everyday uniform — designed outside the expected.
            </p>
          </div>
          <div style={{ marginTop: 24 }} data-home-intro>
            <ButtonLink href="/shop">ENTER THE SHOP ↗</ButtonLink>
          </div>
        </div>

        <span className={styles.scrollCue}>SCROLL TO EXPLORE ↓</span>
      </section>

      <div className={styles.kineticStrip} aria-hidden="true">
        <div className={styles.kineticTrack} data-home-marquee>
          <span>INDEPENDENT SPIRIT</span><span>✳</span>
          <span>FORM IN MOTION</span><span>✳</span>
          <span>NO UNIFORM THINKING</span><span>✳</span>
          <span>STEP INTO KULTURA</span><span>✳</span>
          <span>INDEPENDENT SPIRIT</span><span>✳</span>
          <span>FORM IN MOTION</span><span>✳</span>
          <span>NO UNIFORM THINKING</span><span>✳</span>
          <span>STEP INTO KULTURA</span><span>✳</span>
        </div>
      </div>

      <section className={styles.statement}>
        <div className={styles.statementLabel} data-reveal>
          <div>
            <p>001 / KULTURA STATE OF MIND</p>
            <p>We build clothing as a visual language — strong enough to speak before you do.</p>
          </div>
          <span className={styles.statementMark} aria-hidden="true">✳</span>
        </div>
        <p className={styles.statementCopy} data-reveal>
          NOT MADE TO <em>BLEND IN.</em><br />
          MADE TO BECOME<br />
          PART OF <em>HOW YOU MOVE.</em>
        </p>
      </section>

      <section className={styles.toolSection}>
        <div className={styles.sectionTop} data-reveal>
          <div>
            <p className="eyebrow">002 / THE KULTURA SYSTEM</p>
            <h2>THE IDEA,<br />IN FOUR PARTS.</h2>
          </div>
          <p>
            A product story that moves like an editorial — swipe, scroll and explore the details.
          </p>
        </div>

        <div className={styles.cardRail}>
          {storyCards.map((card) => (
            <Link className={styles.toolCard} href={card.href} key={card.number} data-reveal>
              <div className={styles.toolMedia}>
                <Image src={card.image} alt={card.alt} fill sizes="(max-width: 720px) 83vw, 37vw" />
              </div>
              <div className={styles.toolCopy}>
                <div className={styles.toolNumber}>
                  <span>{card.number}</span>
                  <span>{card.eyebrow}</span>
                </div>
                <div className={styles.toolBottom}>
                  <h3>{card.title}</h3>
                  <p>{card.copy}</p>
                </div>
              </div>
              <span className={styles.toolArrow} aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.productSection}>
        <div className={styles.sectionTop} data-reveal>
          <div>
            <p className="eyebrow">003 / THE ROTATION</p>
            <h2>SELECTED<br />PIECES.</h2>
          </div>
          <p>Drag or swipe through the current KULTURA rotation. Every card goes straight to the product.</p>
        </div>

        <CatalogNotice status={status} empty={!showcase.length} />

        {showcase.length ? (
          <div className={styles.productRail}>
            {showcase.map((product, index) => (
              <article className={styles.productCard} key={product.id} data-reveal>
                <Link href={`/product/${product.slug}`}>
                  <div className={styles.productVisual}>
                    <Image
                      src={product.image}
                      alt={product.images[0]?.alt ?? product.name}
                      fill
                      sizes="(max-width: 720px) 72vw, 31vw"
                    />
                    <span className={styles.productOverlay} />
                    <span className={styles.productChip}>0{index + 1} / KULTURA</span>
                  </div>
                  <div className={styles.productInfo}>
                    <div>
                      <h3>{product.name.replace("KULTURA ", "")}</h3>
                      <p>
                        {[...new Set(product.variants.map((variant) => variant.color.toUpperCase()))].join(" / ") || "—"}
                        {" / "}{product.category.toUpperCase()}
                      </p>
                    </div>
                    <span className={styles.productPrice}>{money(product.price)}</span>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className={styles.editorialSection}>
        <div className={styles.editorialCopy}>
          <div className={styles.editorialSticky} data-reveal>
            <p className="eyebrow">004 / CAMPAIGN 001</p>
            <h2>
              OUTSIDE<br />
              THE<br />
              <span>EXPECTED.</span>
            </h2>
            <p>
              KULTURA lives between utility and attitude. Strong silhouettes, restrained detail and enough room for the person wearing it to finish the story.
            </p>
            <ButtonLink href="/about" secondary>THE KULTURA STATE OF MIND ↗</ButtonLink>
          </div>
          <p className="eyebrow">INDEPENDENT / TBILISI / 2026</p>
        </div>

        <div className={styles.editorialGallery}>
          {editorialImages.map((image, index) => (
            <div className={styles.editorialShot} key={`${image.label}-${index}`} data-reveal>
              <Image src={image.src} alt={image.alt} fill sizes="(max-width: 980px) 100vw, 62vw" />
              <div className={styles.shotMeta}>
                <span>0{index + 1} / {image.label}</span>
                <span>{image.note}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.categorySection}>
        <div className={styles.sectionTop} data-reveal style={{ paddingInline: 0 }}>
          <div>
            <p className="eyebrow">005 / FIND YOUR UNIFORM</p>
            <h2>CHOOSE<br />YOUR LANE.</h2>
          </div>
          <p>Every category is a different entry point into the same KULTURA language.</p>
        </div>

        <div className={styles.categoryGrid}>
          {categories.map((category, index) => (
            <Link className={styles.categoryCard} href={`/shop/${category.slug}`} key={category.slug} data-reveal>
              <span className={styles.categoryNumber}>0{index + 1}</span>
              <h3 className={styles.categoryName}>{category.name}</h3>
              <div className={styles.categoryMeta}>
                <span>SHOP CATEGORY</span>
                <span aria-hidden="true">↗</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.finale}>
        <div className={styles.finaleRing} aria-hidden="true" data-home-ring />
        <div className={styles.finaleContent} data-reveal>
          <span className={styles.finaleMark} aria-hidden="true">✳</span>
          <p className="eyebrow">KULTURA / YOUR NEXT UNIFORM</p>
          <h2>STEP<br />INSIDE.</h2>
          <p>
            Explore the current collection, save your favorites and build the rotation your way.
          </p>
          <div className={styles.ctaRow}>
            <ButtonLink href="/shop">SHOP KULTURA ↗</ButtonLink>
            <ButtonLink href="/drops" secondary>VIEW DROP 001 ↗</ButtonLink>
          </div>
        </div>
      </section>

      <Newsletter />
    </HomeMotion>
  );
}
