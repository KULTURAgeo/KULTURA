import { Suspense } from "react";
import { adminOverviewFast } from "@/lib/admin/overview";
import { OrderList } from "@/components/order-list";
import { AdminBestSellers } from "@/components/admin-best-sellers";
import { money } from "@/lib/catalog";
import styles from "./admin-dashboard.module.css";

function BestSellersFallback() {
  return (
    <section className={styles.panel}>
      <p className="eyebrow">SALES</p>
      <h2>BEST SELLERS</h2>
      <p className="muted">Loading sales analytics…</p>
    </section>
  );
}

export default async function Admin() {
  const data = await adminOverviewFast();
  const metrics = [
    ["ORDERS TODAY", data.todayOrders, "NON-TEST ORDERS"],
    ["REVENUE TODAY", money(data.todayRevenue), "PAID · TBILISI DAY"],
    ["PENDING PAYMENT", data.pendingPayment, "AWAITING PAYMENT"],
    ["LOW STOCK", data.low, "ACTIVE VARIANTS · 1–5"],
  ] as const;

  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">BUSINESS PULSE</p>
          <h1>OVERVIEW</h1>
        </div>
      </div>

      <div className={styles.heroStats}>
        {metrics.map(([label, value, note]) => (
          <div className={styles.metric} key={label}>
            <span className="eyebrow">{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>

      <div className={styles.inventory}>
        {[
          ["TOTAL PRODUCTS", data.total],
          ["ACTIVE PRODUCTS", data.active],
          ["LOW STOCK · 1–5", data.low],
          ["OUT OF STOCK", data.empty],
        ].map(([label, value]) => (
          <div key={label}>
            <span className="eyebrow">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className={styles.split}>
        <Suspense fallback={<BestSellersFallback />}>
          <AdminBestSellers />
        </Suspense>

        <section className={styles.panel}>
          <p className="eyebrow">FULFILLMENT</p>
          <h2>RECENT ORDERS</h2>
          <OrderList orders={data.orders} admin />
        </section>
      </div>
    </>
  );
}
