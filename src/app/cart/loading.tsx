import { Container } from "@/components/ui";

export default function CartLoading() {
  return (
    <Container className="page-section" aria-busy="true" aria-label="Loading bag">
      <div className="commerce-skeleton commerce-skeleton-title" />
      <div className="commerce-skeleton commerce-skeleton-panel" />
    </Container>
  );
}
