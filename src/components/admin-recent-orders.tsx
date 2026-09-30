import { adminRecentOrders } from "@/lib/admin/overview";
import { OrderList } from "@/components/order-list";
import styles from "@/app/admin/admin-dashboard.module.css";

export async function AdminRecentOrders() {
  const orders = await adminRecentOrders();

  return (
    <section className={styles.panel}>
      <p className="eyebrow">FULFILLMENT</p>
      <h2>RECENT ORDERS</h2>
      <OrderList orders={orders} admin />
    </section>
  );
}
