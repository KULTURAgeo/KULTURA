"use server";

import { revalidatePath } from "next/cache";
import { AccessError, safeFailure, type ActionState } from "@/lib/actions";
import { adminMfaActor } from "@/lib/auth/admin-mfa";
import { strictForm } from "@/lib/security/input";
import { rateLimit } from "@/lib/security/rate-limit";
import { protectAction } from "@/lib/security/request";
import { id, InputError } from "@/lib/validation";

type EnrollmentState = ActionState & {
  setup?: { factorId: string; key: string; qr: string | null };
};

async function protectMfaAction(phase: "setup" | "verify") {
  await protectAction("auth");
  const actor = await adminMfaActor(true);
  await rateLimit(`admin-mfa-${phase}`, actor.user.id, phase === "setup" ? 4 : 10, 300);
  const { data, error } = await actor.client.auth.mfa.listFactors();
  if (error) throw new AccessError("unavailable");
  return { mfa: actor.client.auth.mfa, factors: data.all };
}

export async function enrollAdminAuthenticator(
  _state: EnrollmentState, form: FormData,
): Promise<EnrollmentState> {
  try {
    strictForm(form, []);
    const { mfa, factors } = await protectMfaAction("setup");
    if (factors.some(factor => factor.status === "verified")) {
      return { ok: false, message: "An authenticator is already set up. Reload this page to enter its code." };
    }
    // A failed or abandoned setup should be retryable without filling the factor quota.
    for (const factor of factors.filter(item => item.factor_type === "totp" && item.status === "unverified")) {
      const { error } = await mfa.unenroll({ factorId: factor.id });
      if (error) throw new AccessError("unavailable");
    }
    const { data, error } = await mfa.enroll({ factorType: "totp", issuer: "KULTURA" });
    if (error || !data.totp || !/^[A-Z2-7]{16,128}$/.test(data.totp.secret))
      throw new AccessError("unavailable");
    const prefix = "data:image/svg+xml;utf-8,";
    const svg = data.totp.qr_code.startsWith(prefix) ? data.totp.qr_code.slice(prefix.length) : "";
    return {
      ok: true,
      setup: {
        factorId: data.id,
        key: data.totp.secret,
        qr: svg.startsWith("<svg") && svg.length < 100_000
          ? "data:image/svg+xml," + encodeURIComponent(svg) : null,
      },
    };
  } catch (error) {
    return safeFailure(error);
  }
}

export async function verifyAdminAuthenticator(_state: ActionState, form: FormData): Promise<ActionState> {
  try {
    strictForm(form, ["factor_id", "code"]);
    const factorId = id(form.get("factor_id"), "authenticator");
    const code = form.get("code");
    if (typeof code !== "string" || !/^\d{6}$/.test(code))
      throw new InputError("Enter the six-digit code from your authenticator.");
    const { mfa, factors } = await protectMfaAction("verify");
    const factor = factors.find(item => item.id === factorId && item.factor_type === "totp");
    if (!factor || (factor.status !== "verified" && factors.some(item => item.status === "verified")))
      throw new InputError("This authenticator is unavailable. Reload this page and try again.");
    const { error } = await mfa.challengeAndVerify({ factorId, code });
    if (error) {
      if (error.status === 429) return { ok: false, message: "Too many attempts. Wait a few minutes and try again." };
      if ((error.status ?? 500) >= 500) throw new AccessError("unavailable");
      return { ok: false, message: "The code did not match. Try a fresh code from your authenticator." };
    }
    revalidatePath("/admin", "layout");
    return { ok: true, reload: true, redirectTo: "/admin" };
  } catch (error) {
    return safeFailure(error);
  }
}

