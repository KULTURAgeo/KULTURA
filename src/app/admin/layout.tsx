import Link from "next/link";
import { requirePage } from "@/lib/auth/guards";
import { Container } from "@/components/ui";
export const dynamic = "force-dynamic";
export const metadata = { title: "Administration", robots: { index: false, follow: false } };
export default async function AdminLayout({ children }: {
    children: React.ReactNode;
}) {
    await requirePage(true);
    return <Container className="page-section admin-shell"><div className="admin-top"><p className="eyebrow">KULTURA / ADMINISTRATION</p><Link href="/account">YOUR ACCOUNT ↗</Link></div><nav className="account-nav"><Link href="/admin">OVERVIEW</Link><Link href="/admin/products">PRODUCTS</Link><Link href="/admin/inventory">INVENTORY</Link><Link href="/admin/orders">ORDERS</Link><Link href="/admin/promos">PROMOS</Link><Link href="/shop">VIEW STORE ↗</Link></nav>{children}</Container>;
}
