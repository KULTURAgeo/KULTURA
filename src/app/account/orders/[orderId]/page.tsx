import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatusTimeline } from "@/components/order-status-timeline";
import { requirePage } from "@/lib/auth/guards";
import { UUID } from "@/lib/validation";
import styles from "./order-detail.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Order detail",
  robots: { index: false, follow: false },
};

function statusLabel(value: string) {
  return value.replaceAll("_", " ").toUpperCase();
}

function statusClass(value: string) {
  return "status-badge status-" + value.replaceAll("_", "-");
}

export default async function CustomerOrderDetail({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  if (!UUID.test(orderId)) notFound();

  const { client, user } = await requirePage();
  const { data: order, error: orderError } = await client
    .from("orders")
    .select(
      "id,order_number,customer_id,customer_email,currency,subtotal,shipping_total,discount_total,final_total,payment_status,fulfillment_status,delivery_name,delivery_phone,delivery_country_code,delivery_city,delivery_address_line_1,delivery_address_line_2,delivery_postal_code,promo_code_snapshot,created_at,updated_at,paid_at,is_test",
    )
    .eq("id", orderId)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (orderError) throw new Error("Order details are temporarily unavailable.");
  if (!order) notFound();

  const { data: items, error: itemError } = await client
    .from("order_items")
    .select(
      "id,product_name,product_slug,sku,size,color,image_url,unit_price,quantity,discount_total,line_total,created_at",
    )
    .eq("order_id", order.id)
    .order("created_at")
    .order("id");

  if (itemError) throw new Error("Order items are temporarily unavailable.");

  const amount = (value: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: order.currency,
    }).format(value / 100);

  const itemCount = (items ?? []).reduce((sum, item) => sum + item.quantity, 0);
  const placedAt = new Date(order.created_at).toLocaleString("en-GB", {
    timeZone: "UTC",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <section className={styles.page}>
      <div className={styles.top}>
        <div>
          <Link className="text-link" href="/account/orders">
            ← YOUR ORDERS
          </Link>
          <p className="eyebrow">KULTURA / ORDER DETAIL</p>
          <div className={styles.titleRow}>
            <h1>{order.order_number}</h1>
            {order.is_test ? <span className="test-order-badge">TEST</span> : null}
          </div>
          <p className="muted">Placed {placedAt} UTC</p>
        </div>
        <div className="admin-order-status-stack">
          <span className={statusClass(order.payment_status)}>
            PAYMENT · {statusLabel(order.payment_status)}
          </span>
          <span className={statusClass(order.fulfillment_status)}>
            FULFILLMENT · {statusLabel(order.fulfillment_status)}
          </span>
        </div>
      </div>

      <OrderStatusTimeline
        paymentStatus={order.payment_status}
        fulfillmentStatus={order.fulfillment_status}
      />

      <div className="stat-grid order-detail-stats">
        <div className="panel">
          <span className="eyebrow">ORDER TOTAL</span>
          <strong>{amount(order.final_total)}</strong>
        </div>
        <div className="panel">
          <span className="eyebrow">ITEMS</span>
          <strong>{itemCount}</strong>
        </div>
        <div className="panel">
          <span className="eyebrow">PAYMENT</span>
          <strong className="stat-word">{statusLabel(order.payment_status)}</strong>
        </div>
        <div className="panel">
          <span className="eyebrow">FULFILLMENT</span>
          <strong className="stat-word">{statusLabel(order.fulfillment_status)}</strong>
        </div>
      </div>

      <section className={`panel ${styles.itemsPanel}`}>
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">PURCHASED ITEMS</p>
            <h2>{itemCount} ITEM{itemCount === 1 ? "" : "S"}</h2>
          </div>
          <p className="muted">These details are saved from the order and do not change when the catalog is edited.</p>
        </div>

        <div className={styles.items}>
          {(items ?? []).map((item) => (
            <article className={styles.item} key={item.id}>
              <div className={styles.imageWrap}>
                {item.image_url ? (
                  <Image
                    src={item.image_url}
                    alt={item.product_name}
                    fill
                    sizes="(max-width: 700px) 92px, 120px"
                  />
                ) : (
                  <span className={styles.placeholder} aria-hidden="true">K</span>
                )}
              </div>
              <div className={styles.itemCopy}>
                <div>
                  <p className="eyebrow">{item.sku}</p>
                  <h3>{item.product_name}</h3>
                  <p className="muted">{item.color} / {item.size}</p>
                </div>
                <div className={styles.itemNumbers}>
                  <span>QTY <strong>{item.quantity}</strong></span>
                  <span>UNIT <strong>{amount(item.unit_price)}</strong></span>
                  <span>TOTAL <strong>{amount(item.line_total)}</strong></span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="admin-order-detail-grid">
        <section className="panel">
          <p className="eyebrow">DELIVERY</p>
          <h2>{order.delivery_city}</h2>
          <address className="order-address">
            {order.delivery_name}<br />
            {order.delivery_address_line_1}<br />
            {order.delivery_address_line_2 ? <>{order.delivery_address_line_2}<br /></> : null}
            {order.delivery_city}
            {order.delivery_postal_code ? `, ${order.delivery_postal_code}` : ""}<br />
            {order.delivery_country_code}
          </address>
          <p className="muted">{order.delivery_phone}</p>
        </section>

        <section className="panel">
          <p className="eyebrow">TOTALS</p>
          <div className="order-totals">
            <div><span>Subtotal</span><strong>{amount(order.subtotal)}</strong></div>
            {order.discount_total > 0 ? (
              <div>
                <span>{order.promo_code_snapshot ? `Promo · ${order.promo_code_snapshot}` : "Discount"}</span>
                <strong>−{amount(order.discount_total)}</strong>
              </div>
            ) : null}
            <div>
              <span>Shipping</span>
              <strong>{order.shipping_total === 0 ? "FREE" : amount(order.shipping_total)}</strong>
            </div>
            <div className="order-total-final"><span>Total</span><strong>{amount(order.final_total)}</strong></div>
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">ORDER INFO</p>
          <dl className="order-data-list">
            <div><dt>ORDER NUMBER</dt><dd>{order.order_number}</dd></div>
            <div><dt>EMAIL</dt><dd>{order.customer_email}</dd></div>
            <div><dt>PROMO CODE</dt><dd>{order.promo_code_snapshot ?? "—"}</dd></div>
            <div><dt>PAID AT</dt><dd>{order.paid_at ? `${new Date(order.paid_at).toLocaleString("en-GB", { timeZone: "UTC" })} UTC` : "Not paid"}</dd></div>
          </dl>
        </section>

        <section className="panel">
          <p className="eyebrow">LAST UPDATE</p>
          <h2>{statusLabel(order.fulfillment_status)}</h2>
          <p className="muted">
            Updated {new Date(order.updated_at).toLocaleString("en-GB", { timeZone: "UTC" })} UTC
          </p>
          <p className="muted">Refresh this page anytime to see the latest order status.</p>
        </section>
      </div>

      <div className={styles.actions}>
        <Link className="button secondary" href="/account/orders">← ALL ORDERS</Link>
        <Link className="button" href="/shop">CONTINUE SHOPPING ↗</Link>
      </div>
    </section>
  );
}
