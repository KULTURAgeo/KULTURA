import Link from "next/link";
import Image from "next/image";
import { localizedPageMetadata } from "@/lib/site";
import { getServerLocale } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";
import { categoryDisplayName } from "@/lib/category-i18n";
import { shopCategorySlug, shopHref } from "@/lib/catalog/divisions";
import { getShopCategories } from "@/lib/catalog/repository";
import { Container } from "@/components/ui";
import styles from "./shop-gateway.module.css";

export async function generateMetadata() {
  const locale = await getServerLocale();
  return localizedPageMetadata(locale, translate(locale, "Shop"), "/shop");
}

export default async function Shop({ searchParams }: PageProps<"/shop">) {
  const [locale, query] = await Promise.all([getServerLocale(), searchParams]);
  const categorySlug = shopCategorySlug(query.category);
  const selection = categorySlug ? await getShopCategories() : null;
  const category = selection?.categories.find((item) => item.slug === categorySlug);
  const categoryName = categorySlug
    ? categoryDisplayName(locale, category?.name ?? categorySlug.replaceAll("-", " "), categorySlug)
    : undefined;
  const isKa = locale === "ka";
  return (
    <Container className={styles.page}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>
          {categoryName
            ? (isKa ? `${categoryName} · აირჩიე სექცია` : `${categoryName} · CHOOSE A DIVISION`)
            : "THE KULTURA UNIFORM"}
        </p>
        <h1 className={styles.heading}>{translate(locale, "SHOP")} <span className="chrome">/ 03</span></h1>
      </div>
      <nav className={styles.gateway} aria-label={isKa ? "აირჩიე მაღაზიის სექცია" : "Choose your shop division"}>
        <Link href={shopHref("x", categorySlug)} className={styles.tile} aria-label={isKa ? "X — ქალი" : "Shop X — Woman"}>
          <Image src="/images/shop-x.webp" alt="" fill unoptimized
            fetchPriority="high" loading="eager" className={styles.tileImage} />
          <span className={styles.micro}>{categorySlug ? (isKa ? "ქალი" : "WOMEN") : "KULTURA / 01"}</span>
          <span className={styles.title}>X</span>
          <span className={styles.arrow} aria-hidden="true">↗</span>
        </Link>
        <Link href={shopHref("unisex", categorySlug)} className={styles.tile + " " + styles.unisex} aria-label={isKa ? "უნისექსი" : "Shop UNISEX"}>
          <Image src="/images/shop-unisex.webp" alt="" fill unoptimized className={styles.tileImage} />
          <span className={styles.micro}>{categorySlug ? (isKa ? "უნისექსი" : "UNISEX") : "KULTURA / 02"}</span>
          <span className={styles.title}>UNISEX</span>
          <span className={styles.arrow} aria-hidden="true">↗</span>
        </Link>
        <Link href={shopHref("y", categorySlug)} className={styles.tile} aria-label={isKa ? "Y — კაცი" : "Shop Y — Men"}>
          <Image src="/images/shop-y.webp" alt="" fill unoptimized className={styles.tileImage} />
          <span className={styles.micro}>{categorySlug ? (isKa ? "კაცი" : "MEN") : "KULTURA / 03"}</span>
          <span className={styles.title}>Y</span>
          <span className={styles.arrow} aria-hidden="true">↗</span>
        </Link>
      </nav>
    </Container>
  );
}
