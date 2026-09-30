import { Suspense } from "react";
import { AdminDashboardMetrics } from "@/components/admin-dashboard-metrics";
import { AdminRecentOrders } from "@/components/admin-recent-orders";
import { AdminBestSellers } from "@/components/admin-best-sellers";
import styles from "./admin-dashboard.module.css";

function MetricsFallback() {
  return (
    <>
      <div className={styles.heroStats} aria-busy="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div className={styles.metric} key={index}>
            <span className="eyebrow">LOADING</span>
            <strong>—</strong>
            <small>UPDATING BUSINESS DATA</small>
          </div>
        ))}
      </div>
      <div className={styles.inventory} aria-busy="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index}>
            <span className="eyebrow">LOADING</span>
            <strong>—</strong>
          </div>
        ))}
      </div>
    </>
  );
}

function PanelFallback({ title }: { title: string }) {
  return (
    <section className={styles.panel} aria-busy="true">
      <p className="eyebrow">UPDATING</p>
      <h2>{title}</h2>
      <p className="muted">Loading…</p>
    </section>
  );
}

export default function Admin() {
  return (
    <>
      <div className="section-heading">
        <div>
          <p className="eyebrow">BUSINESS PULSE</p>
          <h1>OVERVIEW</h1>
        </div>
      </div>

      <Suspense fallback={<MetricsFallback />}>
        <AdminDashboardMetrics />
      </Suspense>

      <div className={styles.split}>
        <Suspense fallback={<PanelFallback title="BEST SELLERS" />}>
          <AdminBestSellers />
        </Suspense>

        <Suspense fallback={<PanelFallback title="RECENT ORDERS" />}>
          <AdminRecentOrders />
        </Suspense>
      </div>
    </>
  );
}
