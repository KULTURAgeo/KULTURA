import styles from "./order-status-timeline.module.css";

type Props = {
  paymentStatus: string;
  fulfillmentStatus: string;
};

const steps = [
  { key: "saved", label: "ORDER SAVED", detail: "We received your order." },
  { key: "processing", label: "PROCESSING", detail: "Your order is being prepared." },
  { key: "shipped", label: "SHIPPED", detail: "Your order is on the way." },
  { key: "delivered", label: "DELIVERED", detail: "Your order has been delivered." },
] as const;

function label(value: string) {
  return value.replaceAll("_", " ").toUpperCase();
}

function fulfillmentIndex(status: string) {
  if (status === "processing") return 1;
  if (status === "shipped") return 2;
  if (status === "delivered") return 3;
  return 0;
}

function paymentTone(status: string) {
  if (status === "paid") return styles.paymentPaid;
  if (status === "pending") return styles.paymentWarning;
  return styles.paymentProblem;
}

export function OrderStatusTimeline({ paymentStatus, fulfillmentStatus }: Props) {
  const exceptionalFulfillment = fulfillmentStatus === "cancelled" || fulfillmentStatus === "returned";
  const exceptionalPayment = ["failed", "cancelled", "partially_refunded", "refunded"].includes(paymentStatus);
  const isException = exceptionalFulfillment || exceptionalPayment;
  const paid = paymentStatus === "paid";
  const currentIndex = fulfillmentIndex(fulfillmentStatus);

  let title = "ORDER SAVED";
  let notice = "Your order is saved and is waiting for payment before fulfillment can begin.";

  if (paid && fulfillmentStatus === "unfulfilled") {
    title = "ORDER CONFIRMED";
    notice = "Payment is confirmed. Your order is waiting to be prepared.";
  } else if (paid && fulfillmentStatus === "processing") {
    title = "ORDER IN PROCESS";
    notice = "Your order is being prepared for shipment.";
  } else if (paid && fulfillmentStatus === "shipped") {
    title = "ORDER SHIPPED";
    notice = "Your order has left fulfillment and is on the way.";
  } else if (paid && fulfillmentStatus === "delivered") {
    title = "ORDER DELIVERED";
    notice = "Your order is marked as delivered.";
  }

  if (isException) {
    if (fulfillmentStatus === "returned") {
      title = "ORDER RETURNED";
      notice = "This order is marked as returned.";
    } else if (fulfillmentStatus === "cancelled" || paymentStatus === "cancelled") {
      title = "ORDER CANCELLED";
      notice = "This order is marked as cancelled.";
    } else if (paymentStatus === "refunded") {
      title = "PAYMENT REFUNDED";
      notice = "The payment for this order is marked as refunded.";
    } else if (paymentStatus === "partially_refunded") {
      title = "PARTIAL REFUND";
      notice = "This order has a partial refund recorded.";
    } else if (paymentStatus === "failed") {
      title = "PAYMENT FAILED";
      notice = "The payment attempt for this order was not completed successfully.";
    }
  }

  return (
    <section className={styles.shell} aria-labelledby="order-status-heading">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>ORDER STATUS</p>
          <h2 id="order-status-heading">{title}</h2>
        </div>
        <span className={`${styles.payment} ${paymentTone(paymentStatus)}`}>
          PAYMENT · {label(paymentStatus)}
        </span>
      </div>

      <p className={`${styles.notice} ${isException ? styles.problemNotice : ""}`}>
        {notice}
      </p>

      <ol className={styles.timeline} aria-label="Fulfillment progress">
        {steps.map((step, index) => {
          const completed = paid && !isException && index < currentIndex;
          const current = !isException && (
            (index === 0 && (!paid || fulfillmentStatus === "unfulfilled")) ||
            (paid && index === currentIndex)
          );
          const deliveredComplete = paid && fulfillmentStatus === "delivered" && index === 3;
          const stateClass = deliveredComplete || completed
            ? styles.complete
            : current
              ? styles.current
              : "";

          return (
            <li
              key={step.key}
              className={`${styles.step} ${stateClass}`}
              aria-current={current ? "step" : undefined}
            >
              <span className={styles.dot} aria-hidden="true">
                {deliveredComplete || completed ? "✓" : index + 1}
              </span>
              <span className={styles.copy}>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </span>
            </li>
          );
        })}
      </ol>

      {isException ? (
        <div className={styles.exception}>
          CURRENT RECORD · PAYMENT {label(paymentStatus)} · FULFILLMENT {label(fulfillmentStatus)}
        </div>
      ) : null}
    </section>
  );
}
