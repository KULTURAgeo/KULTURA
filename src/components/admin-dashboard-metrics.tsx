import { adminDashboardMetrics } from "@/lib/admin/overview";
import { money } from "@/lib/catalog";
import styles from "@/app/admin/admin-dashboard.module.css";

export async function AdminDashboardMetrics() {
  const data = await adminDashboardMetrics();
  const metrics = [
    ["ORDERS TODAY", data.todayOrders, "NON-TEST ORDERS"],
    ["REVENUE TODAY", money(data.todayRevenue), "PAID · TBILISI DAY"],
    ["PENDING PAYMENT", data.pendingPayment, "AWAITING PAYMENT"],
    ["LOW STOCK", data.low, "ACTIVE VARIANTS · 1–5"],
  ] as const;

  return (
    <>
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
    </>
  );
}
