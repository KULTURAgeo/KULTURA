import Link from "next/link";
import { requirePage } from "@/lib/auth/guards";
import { getProductsByIds } from "@/lib/catalog/repository";
import { ProductCard } from "@/components/product-card";
import { WishlistButton } from "@/components/wishlist-button";
import styles from "./wishlist.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wishlist", robots: { index: false, follow: false } };

export default async function WishlistPage() {
  const { client, user } = await requirePage();
  const { data, error } = await client
    .from("wishlist_items")
    .select("product_id,created_at")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Wishlist unavailable.");

  const ids = (data ?? []).map((item) => item.product_id);
  const { products } = await getProductsByIds(ids);
  const byId = new Map(products.map((product) => [product.id, product]));
  const ordered = ids.flatMap((id) => {
    const product = byId.get(id);
    return product ? [product] : [];
  });

  return (
    <section className="account-section">
      <div className={styles.header}>
        <div>
          <p className="eyebrow">SAVED PIECES</p>
          <h1>WISHLIST</h1>
        </div>
        <span className="muted">{ordered.length} SAVED</span>
      </div>
      {ordered.length ? (
        <div className={styles.grid}>
          {ordered.map((product) => (
            <div className={styles.item} key={product.id}>
              <ProductCard product={product} />
              <WishlistButton product={product} saved />
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <h2>NO SAVED PIECES YET.</h2>
          <p className="muted">Save products while browsing and they will appear here.</p>
          <Link className="button" href="/shop">BROWSE SHOP ↗</Link>
        </div>
      )}
    </section>
  );
}
