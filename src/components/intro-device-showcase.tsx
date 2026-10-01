import Image from "next/image";
import Link from "next/link";
import styles from "./intro-device-showcase.module.css";

export function IntroDeviceShowcase({
  productImage,
  productName,
  productHref,
}: {
  productImage: string;
  productName: string;
  productHref: string;
}) {
  const shortName = productName.replace("KULTURA ", "");

  return (
    <div
      className={styles.stage}
      aria-label="KULTURA mobile storefront preview"
      data-intro-device-stage
    >
      <div className={styles.backdrop} data-intro-device-backdrop>
        <Image
          src="/images/campaign.jpg"
          alt=""
          fill
          sizes="100vw"
          className={styles.backdropImage}
        />
        <div className={styles.backdropTint} />
        <div className={styles.logoPattern} aria-hidden="true" />
        <div className={styles.backdropCopy} aria-hidden="true">
          <span>KULTURA</span>
          <span>STREETWEAR / GEORGIA</span>
        </div>
      </div>

      <Link
        href={productHref}
        className={styles.phone}
        aria-label={`View ${productName}`}
        data-intro-device-phone
      >
        <div className={styles.phoneTop}>
          <span>9:41</span>
          <span className={styles.dynamicIsland} />
          <span>5G&nbsp;&nbsp;◒</span>
        </div>

        <div className={styles.screenViewport}>
          <div className={`${styles.screen} ${styles.screenOne}`} data-device-screen="1">
            <div className={styles.appHeader}>
              <span className={styles.appBrand}>KULTURA</span>
              <span className={styles.appAvatar}>K</span>
            </div>
            <div className={styles.screenLabel}>FEATURED / DROP 001</div>
            <div className={styles.productCard}>
              <Image
                src={productImage}
                alt={productName}
                fill
                sizes="(max-width: 720px) 58vw, 250px"
              />
              <div className={styles.productShade} />
              <div className={styles.productMeta}>
                <strong>{shortName}</strong>
                <span>VIEW PIECE ↗</span>
              </div>
            </div>
            <div className={styles.phoneNav}>
              <span>HOME</span>
              <span>SHOP</span>
              <span>01</span>
            </div>
          </div>

          <div className={`${styles.screen} ${styles.screenTwo}`} data-device-screen="2">
            <div className={styles.generatorTop}>
              <span>PRODUCT STUDIO</span>
              <span>02</span>
            </div>
            <p className={styles.promptLabel}>BUILD YOUR KULTURA</p>
            <p className={styles.promptCopy}>
              Strong silhouette. Clean proportion. Everyday movement.
            </p>
            <div className={styles.generatorImage}>
              <Image src={productImage} alt="" fill sizes="240px" />
              <span className={styles.generatorFrame} />
            </div>
            <div className={styles.generatorBar}>
              <span>GENERATING</span>
              <strong>✳</strong>
            </div>
          </div>

          <div className={`${styles.screen} ${styles.screenThree}`} data-device-screen="3">
            <div className={styles.finalMark}>✳</div>
            <p className={styles.finalEyebrow}>KULTURA / 001</p>
            <h3>STEP INTO<br />KULTURA</h3>
            <p className={styles.finalCopy}>The piece is ready. Make it yours.</p>
            <span className={styles.finalButton}>SHOP THE DROP ↗</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
