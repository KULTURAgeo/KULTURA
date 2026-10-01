import { adminSalesTrend } from "@/lib/admin/overview";
import { money } from "@/lib/catalog";
import styles from "@/app/admin/admin-dashboard.module.css";

export async function AdminSalesTrend() {
  const trend = await adminSalesTrend(7);
  const maxRevenue = Math.max(1, ...trend.days.map((day) => day.revenue));

  return (
    <section className={`${styles.panel} ${styles.trendPanel}`}>
      <div className={styles.trendHeader}>
        <div>
          <p className="eyebrow">LAST 7 DAYS</p>
          <h2>SALES TREND</h2>
        </div>
        <div className={styles.trendTotals}>
          <span><small>REVENUE</small><strong>{money(trend.totalRevenue)}</strong></span>
          <span><small>ORDERS</small><strong>{trend.totalOrders}</strong></span>
          <span><small>AVG ORDER</small><strong>{money(trend.averageOrderValue)}</strong></span>
        </div>
      </div>
      <div className={styles.trendChart} aria-label="Paid revenue over the last seven days">
        {trend.days.map((day) => (
          <div className={styles.trendDay} key={day.key}>
            <div className={styles.trendBarTrack}>
              <div
                className={styles.trendBar}
                style={{ height: `${Math.max(3, Math.round((day.revenue / maxRevenue) * 100))}%` }}
                title={`${day.label}: ${money(day.revenue)} from ${day.orders} orders`}
              />
            </div>
            <strong>{day.label}</strong>
            <small>{day.orders} ord.</small>
            <span>{money(day.revenue)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
