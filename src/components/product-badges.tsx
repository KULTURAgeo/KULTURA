import type { Product } from "@/lib/catalog";
import styles from "./product-badges.module.css";

type ProductBadge = { label: string; tone?: "sale" | "low" | "sold" };

export function getProductBadges(product: Product): ProductBadge[] {
  const totalStock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
  if (totalStock === 0) return [{ label: "SOLD OUT", tone: "sold" }];

  const badges: ProductBadge[] = [];
  if (product.compareAt && product.compareAt > product.price)
    badges.push({ label: "SALE", tone: "sale" });

  const created = Date.parse(product.createdAt);
  if (Number.isFinite(created) && Date.now() - created <= 30 * 24 * 60 * 60 * 1000)
    badges.push({ label: "NEW" });

  if (totalStock <= 5) badges.push({ label: "LOW STOCK", tone: "low" });
  return badges;
}

export function ProductBadges({ product }: { product: Product }) {
  const badges = getProductBadges(product);
  if (!badges.length) return null;
  return (
    <div className={styles.badges} aria-label="Product status">
      {badges.map((badge) => (
        <span
          key={badge.label}
          className={`${styles.badge} ${badge.tone ? styles[badge.tone] : ""}`}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}
