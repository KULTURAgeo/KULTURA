import Link from "next/link";
import { requirePage } from "@/lib/auth/guards";
import { getProductsByIds } from "@/lib/catalog/repository";
import { ProductCard } from "@/components/product-card";
import { WishlistButton } from "@/components/wishlist-button";
import { WishlistAddToBag } from "@/components/wishlist-add-to-bag";
import styles from "./wishlist.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Wishlist",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 24;

export default async function WishlistPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { client, user } = await requirePage();
  const query = await searchParams;
  const page = Math.floor(Math.max(1, Math.min(10000, Number(query.page) || 1)));
  const offset = (page - 1) * PAGE_SIZE;

  const { data, error, count } = await client
    .from("wishlist_items")
    .select("product_id,created_at", { count: "exact" })
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) throw new Error("Wishlist unavailable.");

  const ids = (data ?? []).map((item) => item.product_id);
  const { products } = await getProductsByIds(ids);
  const byId = new Map(products.map((product) => [product.id, product]));
  const ordered = ids.flatMap((id) => {
    const product = byId.get(id);
    return product ? [product] : [];
  });
  const total = count ?? 0;

  return (
    <section className="account-section">
      <div className={styles.header}>
        <div>
          <p className="eyebrow">SAVED PIECES</p>
          <h1>WISHLIST</h1>
        </div>
        <span className="muted">{total} SAVED</span>
      </div>
      {ordered.length ? (
        <>
          <div className={styles.grid}>
            {ordered.map((product) => (
              <div className={styles.item} key={product.id}>
                <ProductCard product={product} />
                <WishlistAddToBag product={product} />
                <WishlistButton product={product} saved />
              </div>
            ))}
          </div>
          <nav className="inline-links" aria-label="Wishlist pagination">
            {page > 1 ? <Link href={`?page=${page - 1}`}>Previous</Link> : null}
            {offset + PAGE_SIZE < total ? <Link href={`?page=${page + 1}`}>Next</Link> : null}
          </nav>
        </>
      ) : total && page > 1 ? (
        <div className={styles.empty}>
          <h2>NO SAVED PIECES ON THIS PAGE.</h2>
          <Link className="button" href="/account/wishlist">BACK TO WISHLIST ↗</Link>
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
