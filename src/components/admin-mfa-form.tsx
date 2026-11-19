"use client";

import Image from "next/image";
import { useActionState } from "react";
import { enrollAdminAuthenticator, verifyAdminAuthenticator } from "@/app/auth/admin-mfa/actions";
import { ActionForm } from "./action-form";
import { Button } from "./ui";

export function AdminMfaForm({ factors }: { factors: { id: string; label: string }[] }) {
  const [enrollment, startSetup, pending] = useActionState(enrollAdminAuthenticator, {});
  const setup = enrollment.setup;
  const authenticator = setup ?? (factors.length === 1 ? { factorId: factors[0].id } : null);
  return (
    <>
      {factors.length === 0 && !setup && (
        <form action={startSetup} className="k-form">
          <p>Set up a verification code with an authenticator app before opening the admin panel.</p>
          <Button type="submit" disabled={pending}>{pending ? "PLEASE WAIT…" : "SET UP AUTHENTICATOR"}</Button>
          {enrollment.message && <p className="form-error" role="alert">{enrollment.message}</p>}
        </form>
      )}
      {setup && (
        <div className="k-form">
          <p>Scan this QR code with your authenticator app, or add the setup key manually.</p>
          {setup.qr && <Image unoptimized src={setup.qr} alt="Authenticator setup QR code" width={192} height={192} />}
          <p>Setup key: <code>{setup.key}</code></p>
        </div>
      )}
      {(setup || factors.length > 0) && (
        <ActionForm action={verifyAdminAuthenticator} label="VERIFY AND OPEN ADMIN">
          {authenticator
            ? <input type="hidden" name="factor_id" value={authenticator.factorId} />
            : <label>Authenticator<select name="factor_id">
                {factors.map(factor => <option key={factor.id} value={factor.id}>{factor.label}</option>)}
              </select></label>}
          <label>Six-digit code
            <input type="text" name="code" inputMode="numeric" autoComplete="one-time-code"
              pattern="[0-9]{6}" maxLength={6} required />
          </label>
        </ActionForm>
      )}
    </>
  );
}

