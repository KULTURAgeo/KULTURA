import Image from "next/image";
import Link from "next/link";
import { money, type Product } from "@/lib/catalog";
import { ProductBadges } from "./product-badges";
import { LocalizedCategoryName } from "./localized-category-name";
import { LocalizedColorNames } from "./localized-color-names";
export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="product-card">
      <Link href={`/product/${product.slug}`}>
        <div className="product-image">
          <Image
            src={product.image}
            alt={product.images[0]?.alt ?? product.name}
            fill
            sizes="(max-width: 767px) 50vw, 25vw"
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
      </Link>
    </article>
  );
}
