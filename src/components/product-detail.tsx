"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { money, type Product } from "@/lib/catalog";
import {useCart} from "./cart-provider";
import { Badge, Button } from "./ui";
import { trackAddToCart, trackViewItem } from "./analytics";
export function ProductDetail({ product }: { product: Product }) {
  const cart=useCart();
  const [size, setSize] = useState("");
  const [view, setView] = useState(0);
  const [message, setMessage] = useState("");
  const colors = [...new Set(product.variants.map((v) => v.color))];
  const [color, setColor] = useState(colors[0]);
  const variant = product.variants.find(
    (v) => v.size === size && v.color === color,
  );
  const soldOut = product.variants.every((v) => v.stock === 0);
  const gallery =
    product.images.length > 1
      ? product.images.map((image, i) => ({
          ...image,
          label: i === 0 ? "Front view" : `View ${i + 1}`,
          crop: false,
        }))
      : [
          {
            src: product.image,
            alt: product.images[0]?.alt ?? product.name,
            label: "Front view",
            crop: false,
          },
          {
            src: product.image,
            alt: product.images[0]?.alt ?? product.name,
            label: "Detail crop",
            crop: true,
          },
        ];
  const currentImage = gallery[view] ?? gallery[0];
  const sampleImagery = product.images.some(image => /^\/images\/(hoodie|tee|pants|cap)\.jpg$/.test(image.src));
  useEffect(() => {
    const track = () =>
      trackViewItem({
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
      });

    track();
    window.addEventListener("kultura:analytics-ready", track, { once: true });
    return () => window.removeEventListener("kultura:analytics-ready", track);
  }, [product.id, product.name, product.category, product.price]);
  return (
    <div className="product-detail">
      <div>
        <div
          className={`gallery-main ${currentImage.crop ? "detail-crop" : ""}`}
        >
          <Image
            src={currentImage.src}
            alt={`${currentImage.alt} — ${currentImage.label}`}
            fill
            priority
            sizes="(max-width: 767px) 100vw, 55vw"
          />
        </div>
        <div className="gallery-thumbs">
          {gallery.map(({ label, src }, i) => (
            <button
              key={label}
              aria-label={label}
              aria-pressed={view === i}
              onClick={() => setView(i)}
            >
              <Image src={src} alt="" width={80} height={90} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        {sampleImagery && <p className="muted">Illustrative sample imagery. Final garment details may differ.</p>}
      </div>
      <div className="product-info">
        <p className="eyebrow">KULTURA / {product.category}</p>
        <h1>{product.name.replace("KULTURA ", "")}</h1>
        <p className="detail-price">{money(product.price)} {product.compareAt && product.compareAt > product.price ? <del className="muted" aria-label="Original price">{money(product.compareAt)}</del> : null}</p>
        {product.drop && <Badge>DROP 001</Badge>}
        <p>{product.description}</p>
        <fieldset>
          <legend>COLOR — {color?.toUpperCase()}</legend>
          {colors.map((c) => (
            <button
              key={c}
              aria-pressed={color === c}
              className="color-choice"
              onClick={() => {
                setColor(c);
                setSize("");
                setMessage("");
              }}
            >
              <span />
              {c}
            </button>
          ))}
        </fieldset>
        <fieldset>
          <legend>SELECT SIZE</legend>
          <div className="size-options">
            {product.variants
              .filter((v) => v.color === color)
              .map((v) => (
                <button
                  key={v.sku}
                  disabled={v.stock === 0}
                  aria-pressed={size === v.size}
                  onClick={() => {
                    setSize(v.size);
                    setMessage("");
                  }}
                >
                  {v.size}
                  <span className="sr-only">
                    {v.stock === 0 ? " — sold out" : ""}
                  </span>
                </button>
              ))}
          </div>
        </fieldset>
        <p className="stock" role="status">
          {soldOut
            ? "Sold out"
            : variant
              ? `${variant.stock} currently available`
              : "Select your size to check availability"}
        </p>
        <Button
          className="add-button"
          disabled={!variant || variant.stock === 0 || cart.busy}
          onClick={async()=>{if(!variant)return;const ok=await cart.add({productId:product.id,variantId:variant.id,size:variant.size,color:variant.color,quantity:1,observedPrice:product.price});if(ok){trackAddToCart({id:product.id,name:product.name,category:product.category,variant:`${variant.color} / ${variant.size}`,price:product.price});}setMessage(ok?"Your bag has been updated.":"Unable to add this item. Please try again.");}}
        >
          {soldOut ? "SOLD OUT" : "ADD TO CART"}{" "}
          <span aria-hidden="true">↗</span>
        </Button>
        <p role="status">{message}</p>
        <p className="muted">Preview collection · Ordering is not open.</p>
        <div className="accordions">
          <details>
            <summary>DETAILS & CARE</summary>
            <p>
              Sample product description. Fabric composition, care instructions
              and final measurements will be confirmed before launch.
            </p>
          </details>
          <details>
            <summary>DELIVERY & RETURNS</summary>
            <p>
              Delivery regions, rates and returns terms will be published before
              ordering opens. No orders are accepted in this preview.
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}
