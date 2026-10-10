import { Container } from "@/components/ui";
import { CartContents } from "@/components/cart-view";
import { getServerLocale } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";
export const metadata = { title: "Your bag", robots: {index:false,follow:false} };
export default async function CartPage() { const locale = await getServerLocale(); return <Container className="page-section"><p className="eyebrow">{translate(locale,"THE KULTURA UNIFORM")}</p><h1 className="page-title">{translate(locale,"YOUR BAG")}</h1><CartContents /></Container>; }
