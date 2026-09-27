import Link from "next/link";
import { requirePage } from "@/lib/auth/guards";
import { Container } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { logout } from "@/app/auth/actions";
export const dynamic = "force-dynamic";
export const metadata = { title: "Your account", robots: {index:false,follow:false} };
export default async function AccountLayout({ children }: {
    children: React.ReactNode;
}) {
    const { profile } = await requirePage();
    return <Container className="page-section account-shell"><p className="eyebrow">YOUR KULTURA</p><nav className="account-nav"><Link href="/account">PROFILE</Link><Link href="/account/orders">ORDERS</Link><Link href="/account/addresses">ADDRESSES</Link>{profile.role === "admin" && <Link href="/admin">ADMIN ↗</Link>}<ActionForm action={logout} label="SIGN OUT"/></nav>{children}</Container>;
}
