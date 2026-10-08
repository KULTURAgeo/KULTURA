import Link from "next/link";
import { requirePage } from "@/lib/auth/guards";
import { Container } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export default async function AccountLayout({ children }: {
  children: React.ReactNode;
}) {
  const { profile } = await requirePage();
  return (
    <Container className="page-section account-shell">
      <p className="eyebrow">YOUR KULTURA</p>
      <nav className="account-nav">
        <Link href="/account">PROFILE</Link>
        <Link href="/account/orders">ORDERS</Link>
        <Link href="/account/wishlist">WISHLIST</Link>
        <Link href="/account/addresses">ADDRESSES</Link>
        {profile.role === "admin" ? <Link href="/admin">ADMIN ↗</Link> : null}
        <form action="/auth/logout" method="post">
          <button className="button" type="submit">SIGN OUT</button>
        </form>
      </nav>
      {children}
    </Container>
  );
}
