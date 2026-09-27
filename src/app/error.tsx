"use client";
import { Container, Button } from "@/components/ui";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Container className="information page-section">
      <h1>Something interrupted the experience.</h1>
      <p>Please try again.</p>
      <Button onClick={reset}>TRY AGAIN</Button>
    </Container>
  );
}
