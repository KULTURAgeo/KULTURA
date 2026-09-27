export const dynamic = "force-dynamic";
import { Container } from "@/components/ui";
import { AuthForm } from "@/components/auth-form";
import { safeNext } from "@/lib/validation";
import { requirePage } from "@/lib/auth/guards";
export const metadata = { robots: { index:false, follow:false }, title: "A FRESH START." };
export default async function Page({ searchParams }: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    await requirePage();
    const params = await searchParams;
    return <Container className="auth-page page-section"><p className="eyebrow">KULTURA ACCOUNT</p><h1>A FRESH START.</h1><p className="muted">Choose a new password for your account.</p>{params.auth_error && <p role="alert">That link is invalid or expired. Request a new one.</p>}{params.reset && <p role="status">Your password was updated. Sign in again.</p>}<AuthForm mode="reset" next={safeNext(params.next)}/></Container>;
}
