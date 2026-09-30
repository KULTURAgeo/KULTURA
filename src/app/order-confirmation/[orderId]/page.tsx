import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui";
import { OrderStatusTimeline } from "@/components/order-status-timeline";
import { requirePage } from "@/lib/auth/guards";
import { UUID } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Order confirmation",
  robots: { index: false, follow: false },
};

function statusLabel(value: string) {
  return value.replaceAll("_", " ").toUpperCase();
}

function statusClass(value: string) {
  return "status-badge status-" + value.replaceAll("_", "-");
}

function confirmationMessage(paymentStatus: string) {
  if (paymentStatus === "pending") {
    return "Your order has been saved successfully. No payment has been taken yet.";
  }
  if (paymentStatus === "paid") {
    return "Your order is saved and payment is marked as confirmed.";
  }
  return "Your order is saved. Check the latest payment and fulfillment status below.";
}

function nextStep(paymentStatus: string, fulfillmentStatus: string) {
  if (fulfillmentStatus === "returned") {
    return {
      title: "ORDER RETURNED",
      body: "This order is marked as returned. The payment status above shows the latest recorded payment outcome.",
    };
  }
  if (fulfillmentStatus === "cancelled" || paymentStatus === "cancelled") {
    return {
      title: "ORDER CANCELLED",
      body: "This order is marked as cancelled. No further fulfillment steps are expected unless the order record changes.",
    };
  }
  if (paymentStatus === "failed") {
    return {
      title: "PAYMENT FAILED",
      body: "The payment attempt is marked as failed. Fulfillment will not begin until a valid payment is confirmed.",
    };
  }
  if (paymentStatus === "refunded" || paymentStatus === "partially_refunded") {
    return {
      title: paymentStatus === "refunded" ? "PAYMENT REFUNDED" : "PARTIAL REFUND",
      body: "A refund is recorded on this order. The fulfillment status above shows the latest delivery state.",
    };
  }
  if (paymentStatus !== "paid") {
    return {
      title: "PAYMENT PENDING",
      body: "The order is stored in your account but has not been paid. Fulfillment begins only after payment is confirmed.",
    };
  }
  if (fulfillmentStatus === "processing") {
    return {
      title: "BEING PREPARED",
      body: "Your order is currently being prepared. The next fulfillment step is shipment.",
    };
  }
  if (fulfillmentStatus === "shipped") {
    return {
      title: "ON THE WAY",
      body: "Your order is marked as shipped. The next fulfillment step is delivery.",
    };
  }
  if (fulfillmentStatus === "delivered") {
    return {
      title: "DELIVERED",
      body: "Your order is marked as delivered. This is the final fulfillment stage.",
    };
  }
  return {
    title: "PAYMENT CONFIRMED",
    body: "Payment is confirmed and your order is waiting to move into processing.",
  };
}

export default async function OrderConfirmation({
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
      "id,order_number,customer_id,customer_email,currency,subtotal,shipping_total,discount_total,final_total,payment_status,fulfillment_status,delivery_name,delivery_phone,delivery_country_code,delivery_city,delivery_address_line_1,delivery_address_line_2,delivery_postal_code,promo_code_snapshot,created_at,is_test",
    )
    .eq("id", orderId)
    .eq("customer_id", user.id)
    .maybeSingle();

  if (orderError) throw new Error("Order confirmation is temporarily unavailable.");
  if (!order) notFound();

  const { data: items, error: itemError } = await client
    .from("order_items")
    .select(
      "id,product_name,product_slug,sku,size,color,image_url,unit_price,quantity,discount_total,line_total",
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
  const next = nextStep(order.payment_status, order.fulfillment_status);

  return (
    <Container className="page-section">
      <div className="admin-order-detail-top">
        <div>
          <p className="eyebrow">KULTURA / ORDER DETAILS</p>
          <h1 className="page-title">{order.order_number}</h1>
          <p className="muted">{confirmationMessage(order.payment_status)}</p>
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
          <span className="eyebrow">ORDER</span>
          <strong className="stat-word">{order.order_number}</strong>
        </div>
        <div className="panel">
          <span className="eyebrow">ITEMS</span>
          <strong>{itemCount}</strong>
        </div>
        <div className="panel">
          <span className="eyebrow">TOTAL</span>
          <strong>{amount(order.final_total)}</strong>
        </div>
        <div className="panel">
          <span className="eyebrow">PLACED</span>
          <strong className="stat-word">
            {new Date(order.created_at).toLocaleDateString("en-GB")}
          </strong>
        </div>
      </div>

      <div className="admin-order-detail-grid">
        <section className="panel">
          <p className="eyebrow">CUSTOMER</p>
          <h2>{order.delivery_name}</h2>
          <dl className="order-data-list">
            <div><dt>EMAIL</dt><dd>{order.customer_email}</dd></div>
            <div><dt>PHONE</dt><dd>{order.delivery_phone}</dd></div>
            <div><dt>ORDER NUMBER</dt><dd>{order.order_number}</dd></div>
          </dl>
        </section>

        <section className="panel">
          <p className="eyebrow">DELIVERY ADDRESS</p>
          <h2>{order.delivery_city}</h2>
          <address className="order-address">
            {order.delivery_name}<br />
            {order.delivery_address_line_1}<br />
            {order.delivery_address_line_2 ? <>{order.delivery_address_line_2}<br /></> : null}
            {order.delivery_city}
            {order.delivery_postal_code ? `, ${order.delivery_postal_code}` : ""}<br />
            {order.delivery_country_code}
          </address>
        </section>

        <section className="panel">
          <p className="eyebrow">TOTALS</p>
          <div className="order-totals">
            <div><span>Subtotal</span><strong>{amount(order.subtotal)}</strong></div>
            {order.promo_code_snapshot ? (
              <div>
                <span>Promo · {order.promo_code_snapshot}</span>
                <strong>−{amount(order.discount_total)}</strong>
              </div>
            ) : order.discount_total > 0 ? (
              <div><span>Discount</span><strong>−{amount(order.discount_total)}</strong></div>
            ) : null}
            <div>
              <span>Shipping</span>
              <strong>{order.shipping_total === 0 ? "FREE" : amount(order.shipping_total)}</strong>
            </div>
            <div className="order-total-final">
              <span>Total</span><strong>{amount(order.final_total)}</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <p className="eyebrow">WHAT HAPPENS NEXT</p>
          <h2>{next.title}</h2>
          <p className="muted">{next.body}</p>
        </section>
      </div>

      <section className="panel admin-order-items">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">ORDER SUMMARY</p>
            <h2>{itemCount} ITEM{itemCount === 1 ? "" : "S"}</h2>
          </div>
        </div>
        <div className="table-scroll">
          <table className="k-table">
            <caption className="sr-only">Purchased item snapshots</caption>
            <thead>
              <tr>
                <th>ITEM</th>
                <th>VARIANT</th>
                <th>QTY</th>
                <th>UNIT PRICE</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.product_name}</strong>
                    <small>{item.sku}</small>
                  </td>
                  <td>{item.color} / {item.size}</td>
                  <td>{item.quantity}</td>
                  <td>{amount(item.unit_price)}</td>
                  <td>{amount(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="inline-links">
        <Link className="button" href="/shop">CONTINUE SHOPPING</Link>
        <Link className="button secondary" href="/account/orders">VIEW YOUR ORDERS</Link>
      </div>
    </Container>
  );
}
