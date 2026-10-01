import { Container } from "@/components/ui";

export default function ProductLoading() {
  return (
    <Container className="page-section" aria-busy="true" aria-label="Loading product">
      <div className="commerce-skeleton-product-page">
        <div className="commerce-skeleton commerce-skeleton-product-image" />
        <div className="commerce-skeleton commerce-skeleton-product-copy" />
      </div>
    </Container>
  );
}
