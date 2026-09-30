"use client";

import Link from "next/link";

export default function OrderConfirmationError({ reset }: { reset: () => void }) {
  return (
    <section className="page-section">
      <p className="eyebrow">KULTURA / ORDER CONFIRMATION</p>
      <h1 className="page-title">ORDER UNAVAILABLE</h1>
      <p className="muted">
        We could not load this order right now. Your saved order is not changed.
      </p>
      <div className="inline-links">
        <button className="button" type="button" onClick={() => reset()}>
          TRY AGAIN
        </button>
        <Link className="button secondary" href="/account/orders">YOUR ORDERS</Link>
      </div>
    </section>
  );
}
