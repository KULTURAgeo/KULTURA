import { Container, ButtonLink } from "@/components/ui";
export default function NotFound() {
  return (
    <Container className="information page-section">
      <p className="eyebrow">404 / OUTSIDE THE COLLECTION</p>
      <h1 className="page-title">LOST YOUR WAY?</h1>
      <ButtonLink href="/shop">BACK TO SHOP ↗</ButtonLink>
    </Container>
  );
}
