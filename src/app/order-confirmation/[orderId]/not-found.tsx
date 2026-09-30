import Link from "next/link";
import { Container } from "@/components/ui";

export default function OrderConfirmationNotFound() {
  return (
    <Container className="page-section">
      <p className="eyebrow">KULTURA / ORDER CONFIRMATION</p>
      <h1 className="page-title">ORDER NOT FOUND</h1>
      <p className="muted">
        This order does not exist or it does not belong to the signed-in account.
      </p>
      <div className="inline-links">
        <Link className="button" href="/account/orders">VIEW YOUR ORDERS</Link>
        <Link className="button secondary" href="/shop">CONTINUE SHOPPING</Link>
      </div>
    </Container>
  );
}
