import Link from "next/link";
import { requirePage } from "@/lib/auth/guards";
import { Container } from "@/components/ui";
import { AdminNavigation } from "@/components/admin-navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administration", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: {
  children: React.ReactNode;
}) {
  // Keep the server-side admin gate: prefetching must never grant access.
  await requirePage(true);

  return (
    <Container className="page-section admin-shell">
      <div className="admin-top">
        <p className="eyebrow">KULTURA / ADMINISTRATION</p>
        <Link href="/account">YOUR ACCOUNT ↗</Link>
      </div>
      <AdminNavigation />
      {children}
    </Container>
  );
}
