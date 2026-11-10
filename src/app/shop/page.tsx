import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/site";
import { Container } from "@/components/ui";
import styles from "./shop-gateway.module.css";

export const metadata: Metadata = pageMetadata("Shop", "/shop");

export default function Shop() {
  return (
    <Container className={styles.page}>
      <div className={styles.intro}>
        <p className={styles.eyebrow}>THE KULTURA UNIFORM</p>
        <h1 className={styles.heading}>SHOP <span className="chrome">/ 03</span></h1>
      </div>
      <nav className={styles.gateway} aria-label="Choose your shop division">
        <Link href="/shop/x" className={styles.tile + " " + styles.x} aria-label="Shop X — Woman">
          <span className={styles.micro}>KULTURA / 01</span>
          <span className={styles.title}>X</span>
          <span className={styles.arrow} aria-hidden="true">↗</span>
        </Link>
        <Link href="/shop/y" className={styles.tile + " " + styles.y} aria-label="Shop Y — Men">
          <span className={styles.micro}>KULTURA / 02</span>
          <span className={styles.title}>Y</span>
          <span className={styles.arrow} aria-hidden="true">↗</span>
        </Link>
        <Link href="/shop/unisex" className={styles.tile + " " + styles.unisex} aria-label="Shop UNISEX">
          <span className={styles.micro}>KULTURA / 03</span>
          <span className={styles.title}>UNISEX</span>
          <span className={styles.arrow} aria-hidden="true">↗</span>
        </Link>
      </nav>
    </Container>
  );
}
