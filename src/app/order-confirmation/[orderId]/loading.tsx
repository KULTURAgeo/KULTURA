import { Container } from "@/components/ui";

export default function OrderConfirmationLoading() {
  return (
    <Container className="page-section">
      <p className="eyebrow">KULTURA / ORDER CONFIRMATION</p>
      <h1 className="page-title">LOADING ORDER…</h1>
      <p className="muted">Retrieving your saved order details.</p>
    </Container>
  );
}
