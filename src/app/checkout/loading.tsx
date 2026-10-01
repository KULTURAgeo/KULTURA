import { Container } from "@/components/ui";

export default function CheckoutLoading() {
  return (
    <Container className="checkout-page page-section" aria-busy="true" aria-label="Loading checkout">
      <div className="commerce-skeleton commerce-skeleton-title" />
      <div className="commerce-skeleton-grid">
        <div className="commerce-skeleton commerce-skeleton-panel commerce-skeleton-tall" />
        <div className="commerce-skeleton commerce-skeleton-panel" />
      </div>
    </Container>
  );
}
