import { Container } from "@/components/ui";

export default function ShopLoading() {
  return (
    <Container className="page-section" aria-busy="true" aria-label="Loading products">
      <div className="commerce-skeleton commerce-skeleton-title" />
      <div className="commerce-skeleton-products">
        {Array.from({ length: 8 }, (_, index) => (
          <div className="commerce-skeleton commerce-skeleton-product" key={index} />
        ))}
      </div>
    </Container>
  );
}
