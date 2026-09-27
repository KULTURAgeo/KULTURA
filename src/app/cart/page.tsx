import { Container } from "@/components/ui";
import { CartContents } from "@/components/cart-view";
export const metadata = { title: "Your bag", robots: {index:false,follow:false} };
export default function CartPage() { return <Container className="page-section"><p className="eyebrow">THE KULTURA UNIFORM</p><h1 className="page-title">YOUR BAG</h1><CartContents /></Container>; }
