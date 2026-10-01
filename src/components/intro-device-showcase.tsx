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
  return (
    <div className={styles.stage} aria-label="KULTURA mobile storefront preview">
      <div className={styles.backdrop}>
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
          <span>GEORGIA / 2026</span>
        </div>
      </div>

      <Link href={productHref} className={styles.phone} aria-label={`View ${productName}`}>
        <div className={styles.phoneTop}>
          <span>9:41</span>
          <span className={styles.dynamicIsland} />
          <span>5G&nbsp;&nbsp;◒</span>
        </div>

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
            <strong>{productName.replace("KULTURA ", "")}</strong>
            <span>VIEW PIECE ↗</span>
          </div>
        </div>

        <div className={styles.phoneNav}>
          <span>HOME</span>
          <span>SHOP</span>
          <span>01</span>
        </div>
      </Link>
    </div>
  );
}
