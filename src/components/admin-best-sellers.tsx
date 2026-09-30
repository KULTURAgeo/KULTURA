import { adminBestSellers } from "@/lib/admin/overview";
import { money } from "@/lib/catalog";
import styles from "@/app/admin/admin-dashboard.module.css";

export async function AdminBestSellers() {
  const bestSellers = await adminBestSellers();

  return (
    <section className={styles.panel}>
      <p className="eyebrow">SALES</p>
      <h2>BEST SELLERS</h2>
      {bestSellers.length ? (
        <div className={styles.sellers}>
          {bestSellers.map((seller, index) => (
            <div className={styles.seller} key={seller.name}>
              <span className={styles.rank}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <strong>{seller.name}</strong>
                <span className="muted">{seller.units} UNITS</span>
              </div>
              <span>{money(seller.sales)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">Best sellers will appear after paid non-test orders.</p>
      )}
    </section>
  );
}
