import { redirect } from "next/navigation";
import { AccessError } from "@/lib/actions";
import { hasVerifiedAdminSession } from "@/lib/auth/access";
import { adminMfaActor } from "@/lib/auth/admin-mfa";
import { Container } from "@/components/ui";
import { AdminMfaForm } from "@/components/admin-mfa-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin verification", robots: { index: false, follow: false } };

export default async function AdminMfaPage() {
  const { client, user } = await adminMfaActor().catch((error: unknown) => {
    if (error instanceof AccessError && error.code === "unauthenticated") redirect("/login?next=/admin");
    if (error instanceof AccessError && error.code === "forbidden") redirect("/account?restricted=1");
    throw error;
  });
  if (await hasVerifiedAdminSession(client, user.id)) redirect("/admin");
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) throw new AccessError("unavailable");
  const factors = data.totp.map((factor, index) => ({
    id: factor.id,
    label: factor.friendly_name || `Authenticator ${index + 1}`,
  }));
  return (
    <Container className="auth-page page-section">
      <h1>ADMIN VERIFICATION</h1>
      {factors.length === 0 && data.all.some(factor => factor.status === "verified")
        ? <p role="alert">A different second factor is already registered. Contact the site owner to recover access.</p>
        : <AdminMfaForm factors={factors} />}
      <form action="/auth/logout" method="post">
        <button className="button secondary" type="submit">SIGN OUT</button>
      </form>
    </Container>
  );
}

