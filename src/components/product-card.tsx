import { MotionProductCard } from "./motion-product-card";
import { ProductCardPreview } from "./product-card-preview";
import { money, type Product } from "@/lib/catalog";
import { ProductBadges } from "./product-badges";
import { LocalizedCategoryName } from "./localized-category-name";
import { LocalizedColorNames } from "./localized-color-names";
export function ProductCard({ product, stockLabel }: { product: Product; stockLabel?: string }) {
  const name = product.name.replace("KULTURA ", "");
  const photos = product.images.length ? product.images : [{ src: product.image, alt: name }];
  return (
    <MotionProductCard>
      <ProductCardPreview href={`/product/${product.slug}`} name={name} photos={photos}
        badges={<ProductBadges product={product} />}>
        <div className="product-meta">
          <h3>{name}</h3>
          <span>{money(product.price)}</span>
        </div>
        <p className="product-subtitle">
          <LocalizedColorNames colors={[...new Set(product.variants.map(v => v.color))]} /> / <LocalizedCategoryName name={product.category} slug={product.categorySlug} />
        </p>
        {stockLabel && <p className="product-subtitle">{stockLabel}</p>}
      </ProductCardPreview>
    </MotionProductCard>
  );
}
