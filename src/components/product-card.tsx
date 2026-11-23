import { MotionProductCard } from "./motion-product-card";
import Image from "next/image";
import Link from "next/link";
import { money, type Product } from "@/lib/catalog";
import { ProductBadges } from "./product-badges";
import { LocalizedCategoryName } from "./localized-category-name";
import { LocalizedColorNames } from "./localized-color-names";
export function ProductCard({ product, stockLabel }: { product: Product; stockLabel?: string }) {
  return (
    <MotionProductCard>
      <Link href={`/product/${product.slug}`} prefetch={false}>
        <div className="product-image">
          <Image
            src={product.image}
            alt={product.images[0]?.alt ?? product.name}
            fill
            quality={75}
            sizes="(max-width: 360px) calc(100vw - 40px), (max-width: 767px) calc(50vw - 26px), (max-width: 1480px) 24vw, 350px"
          />
          <div className="product-badge">
            <ProductBadges product={product} />
          </div>
          <span className="product-arrow" aria-hidden="true">
            ↗
          </span>
        </div>
        <div className="product-meta">
          <h3>{product.name.replace("KULTURA ", "")}</h3>
          <span>{money(product.price)}</span>
        </div>
        <p className="product-subtitle">
          <LocalizedColorNames colors={[...new Set(product.variants.map(v => v.color))]} /> / <LocalizedCategoryName name={product.category} slug={product.categorySlug} />
        </p>
        {stockLabel && <p className="product-subtitle">{stockLabel}</p>}
      </Link>
    </MotionProductCard>
  );
}
