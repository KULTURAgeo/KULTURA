"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui";
import { MAX_UPLOAD_BYTES, UPLOAD_SIZE_MESSAGE } from "@/lib/upload-limits";
import type { ActionState } from "@/lib/actions";

export function ActionForm({
  action,
  children,
  label = "SAVE",
  confirm,
  className = "",
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  label?: string;
  confirm?: string;
  className?: string;
}) {
  const [localError, setLocalError] = useState("");
  const [state, formAction, pending] = useActionState(
    async (previous: ActionState, data: FormData): Promise<ActionState> => {
      try {
        return await action(previous, data);
      } catch {
        return {
          ok: false,
          message: "The request could not be completed. Check your connection and try again.",
        };
      }
    },
    {},
  );
  const router = useRouter();

  useEffect(() => {
    if (state.redirectTo) {
      if (state.reload) {
        window.location.replace(state.redirectTo);
        return;
      }
      router.replace(state.redirectTo);
      router.refresh();
    } else if (state.ok) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form
      onReset={(event) => event.preventDefault()}
      action={formAction}
      className={`k-form ${className}`}
      onSubmit={(event) => {
        setLocalError("");
        if (pending || (confirm && !window.confirm(confirm))) {
          event.preventDefault();
          return;
        }
        const files = Array.from(
          event.currentTarget.querySelectorAll<HTMLInputElement>('input[type="file"]'),
        ).flatMap((input) => Array.from(input.files ?? []));
        if (files.some((file) => file.size > MAX_UPLOAD_BYTES)) {
          event.preventDefault();
          setLocalError(UPLOAD_SIZE_MESSAGE);
        }
      }}
    >
      <fieldset disabled={pending}>
        {children}
        <Button type="submit" disabled={pending}>
          {pending ? "PLEASE WAIT…" : label}
        </Button>
      </fieldset>
      <p
        role={!localError && state.ok ? "status" : "alert"}
        className={!localError && state.ok ? "form-success" : "form-error"}
      >
        {localError || state.message}
      </p>
    </form>
  );
}
