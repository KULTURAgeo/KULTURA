"use server";
import { assertSameOrigin, protectAction } from "@/lib/security/request";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/security/rate-limit";
import { strictForm } from "@/lib/security/input";
import { revalidatePath } from "next/cache";
import { createSessionClient } from "@/lib/supabase/session";
import { siteOrigin } from "@/lib/supabase/config";
import { requireActor } from "@/lib/auth/guards";
import { email, password, safeNext, InputError } from "@/lib/validation";
import { safeFailure, AccessError, type ActionState } from "@/lib/actions";
export async function authenticate(_state: ActionState, data: FormData): Promise<ActionState> {
    try {
        await protectAction("auth");
        strictForm(data, ["mode", "email", "password", "confirm_password", "next"]);
        const mode = data.get("mode");
        if (["login", "register", "forgot"].includes(String(mode))) await rateLimit("auth-account", email(data).toLowerCase(), 12, 900);
        const client = await createSessionClient(true);
        if (!client)
            throw new AccessError("unavailable");
        if (mode === "login") {
            const { error } = await client.auth.signInWithPassword({ email: email(data), password: password(data, false) });
            if (error)
                return { ok: false, message: "Unable to sign in. Check your details and email confirmation, then try again." };
            revalidatePath("/account", "layout");
            revalidatePath("/admin", "layout");
            return { ok: true, reload: true, redirectTo: safeNext(data.get("next")) };
        }
        if (mode === "register") {
            const { error } = await client.auth.signUp({ email: email(data), password: password(data), options: { emailRedirectTo: siteOrigin() + "/auth/callback" } });
            if (error)
                return { ok: false, message: "Registration could not be completed. Check your details or try again later." };
            return { ok: true, message: "Check your email to confirm your account. If you already have an account, sign in or reset your password." };
        }
        if (mode === "forgot") {
            const address = email(data);
            const {error: resetError} = await client.auth.resetPasswordForEmail(address, { redirectTo: siteOrigin() + "/auth/callback?next=/reset-password" });
            if (resetError && (resetError.status === 429 || (resetError.status ?? 0) >= 500)) return {ok:false,message:"Password reset is temporarily unavailable. Please try again shortly."};
            return { ok: true, message: "If an account exists for this email, you will receive a password reset link shortly." };
        }
        if (mode === "reset") {
            await requireActor();
            const { error } = await client.auth.updateUser({ password: password(data) });
            if (error)
                return { ok: false, message: "Unable to update the password. Request a fresh reset link and try again." };
            const { error: signOutError } = await client.auth.signOut({ scope: "global" });
            if (signOutError) throw signOutError;
            revalidatePath("/account", "layout");
            revalidatePath("/admin", "layout");
            return { ok: true, reload: true, redirectTo: "/login?reset=1" };
        }
        throw new InputError("Invalid request.");
    }
    catch (error) {
        return safeFailure(error);
    }
}
export async function logout(): Promise<ActionState> {
    try {
        // Signing out must remain available when the shared rate backend is down.
        assertSameOrigin(new Headers(await headers()));
        const client = await createSessionClient(true);
        if (!client)
            throw new AccessError("unavailable");
        const { error } = await client.auth.signOut({ scope: "local" });
        if (error)
            throw error;
        revalidatePath("/account", "layout");
            revalidatePath("/admin", "layout");
        return { ok: true, reload: true, redirectTo: "/login" };
    }
    catch (error) {
        return safeFailure(error);
    }
}
