import Link from "next/link";
import { ActionForm, Field } from "./action-form";
import { authenticate } from "@/app/auth/actions";
export function AuthForm({ mode, next = "/account" }: {
    mode: "login" | "register" | "forgot" | "reset";
    next?: string;
}) {
    return <><ActionForm action={authenticate} label={{ login: "SIGN IN", register: "CREATE ACCOUNT", forgot: "SEND RESET LINK", reset: "SET NEW PASSWORD" }[mode]}><input type="hidden" name="mode" value={mode}/><input type="hidden" name="next" value={next}/>{mode !== "reset" && <Field label="EMAIL" name="email" type="email" required maxLength={254} autoComplete="email"/>}{mode !== "forgot" && <><Field label="PASSWORD" name="password" type="password" required maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"}/>{mode !== "login" && <><p className="muted">Use 12–128 characters.</p><Field label="CONFIRM PASSWORD" name="confirm_password" type="password" required maxLength={128} autoComplete="new-password"/></>}</>}</ActionForm><nav className="inline-links">{mode === "login" ? <><Link href="/forgot-password">Forgot password?</Link><Link href="/register">Create an account ↗</Link></> : <Link href="/login">Back to sign in ↗</Link>}</nav></>;
}
