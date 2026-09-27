import Link from "next/link";
import { Container } from "@/components/ui";

export const metadata = { title: "Test checkout cancelled", robots: { index: false, follow: false } };

export default function CheckoutCancelled() {
  return <Container className="page-section"><p className="eyebrow">STRIPE TEST MODE</p><h1 className="page-title">CHECKOUT CANCELLED</h1><p>No payment was completed and your bag is still available.</p><Link className="text-link" href="/cart">RETURN TO YOUR BAG ↗</Link></Container>;
}
