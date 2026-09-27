import { Container } from "@/components/ui";
import { AuthForm } from "@/components/auth-form";
import { safeNext } from "@/lib/validation";
export const metadata = { robots: { index:false, follow:false }, title: "STEP INSIDE." };
export default async function Page({ searchParams }: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await searchParams;
    return <Container className="auth-page page-section"><p className="eyebrow">KULTURA ACCOUNT</p><h1>STEP INSIDE.</h1><p className="muted">Create your KULTURA account.</p>{params.auth_error && <p role="alert">That link is invalid or expired. Request a new one.</p>}{params.reset && <p role="status">Your password was updated. Sign in again.</p>}<AuthForm mode="register" next={safeNext(params.next)}/></Container>;
}
