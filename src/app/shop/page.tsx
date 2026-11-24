import Link from "next/link";
import Image from "next/image";
import { localizedPageMetadata } from "@/lib/site";
import { getServerLocale } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";
import { Container } from "@/components/ui";
import styles from "./shop-gateway.module.css";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return localizedPageMetadata(locale, translate(locale, "Shop"), "/shop");
}

export default async function Shop() {
  const locale = await getServerLocale();
  return (
    <Container className={styles.page}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>THE KULTURA UNIFORM</p>
        <h1 className={styles.heading}>{translate(locale, "SHOP")} <span className="chrome">/ 03</span></h1>
      </div>
      <nav className={styles.gateway} aria-label="Choose your shop division">
        <Link href="/shop/x" className={styles.tile} aria-label="Shop X — Woman">
          <Image src="/images/shop-x.webp" alt="" fill unoptimized
            fetchPriority="high" loading="eager" className={styles.tileImage} />
          <span className={styles.micro}>KULTURA / 01</span>
          <span className={styles.title}>X</span>
          <span className={styles.arrow} aria-hidden="true">↗</span>
        </Link>
        <Link href="/shop/unisex" className={styles.tile + " " + styles.unisex} aria-label="Shop UNISEX">
          <Image src="/images/shop-unisex.webp" alt="" fill unoptimized className={styles.tileImage} />
          <span className={styles.micro}>KULTURA / 02</span>
          <span className={styles.title}>UNISEX</span>
          <span className={styles.arrow} aria-hidden="true">↗</span>
        </Link>
        <Link href="/shop/y" className={styles.tile} aria-label="Shop Y — Men">
          <Image src="/images/shop-y.webp" alt="" fill unoptimized className={styles.tileImage} />
          <span className={styles.micro}>KULTURA / 03</span>
          <span className={styles.title}>Y</span>
          <span className={styles.arrow} aria-hidden="true">↗</span>
        </Link>
      </nav>
    </Container>
  );
}
