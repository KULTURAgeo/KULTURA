import { Container } from "@/components/ui";

export default function ReviewOrderLoading() {
  return (
    <Container className="page-section" aria-busy="true" aria-label="Loading order review">
      <div className="commerce-skeleton commerce-skeleton-title" />
      <div className="commerce-skeleton-grid">
        <div className="commerce-skeleton commerce-skeleton-panel" />
        <div className="commerce-skeleton commerce-skeleton-panel" />
      </div>
    </Container>
  );
}
