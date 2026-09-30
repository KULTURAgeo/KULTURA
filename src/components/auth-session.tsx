"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { PublicAuthConfig } from "@/lib/supabase/client";

export function AuthSession({ config }: { config: PublicAuthConfig | null }) {
  const router = useRouter();

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void import("@/lib/supabase/client").then(({ createBrowserSessionClient }) => {
      if (cancelled) return;
      const client = createBrowserSessionClient(config);
      const { data } = client.auth.onAuthStateChange((event) => {
        // Login/logout actions navigate after their response cookies arrive.
        // Browser refreshes and cross-tab sign-out must invalidate server UI too.
        if (event === "TOKEN_REFRESHED" || event === "SIGNED_OUT") router.refresh();
      });
      unsubscribe = () => data.subscription.unsubscribe();
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [config, router]);

  return null;
}
