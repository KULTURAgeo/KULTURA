import Image from "next/image";
import Link from "next/link";
import { money, type Product } from "@/lib/catalog";
import { Badge } from "./ui";
export function ProductCard({ product }: { product: Product }) {
  const soldOut = product.variants.every((v) => v.stock === 0);
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
            {soldOut ? (
              <Badge>Sold out</Badge>
            ) : product.drop ? (
              <Badge>Drop 001</Badge>
            ) : null}
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
          {[...new Set(product.variants.map(v => v.color.toUpperCase()))].join(" / ") || "—"} / {product.category.toUpperCase()}
        </p>
      </Link>
    </article>
  );
}
