"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSessionClient, type PublicAuthConfig } from "@/lib/supabase/client";

export function AuthSession({ config }: { config: PublicAuthConfig | null }) {
  const router = useRouter();
  useEffect(() => {
    if (!config) return;
    const client = createBrowserSessionClient(config);
    const { data: { subscription } } = client.auth.onAuthStateChange(event => {
      // Login/logout actions navigate after their response cookies arrive.
      // Browser refreshes and cross-tab sign-out must invalidate server UI too.
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_OUT") router.refresh();
    });
    return () => subscription.unsubscribe();
  }, [config, router]);
  return null;
}
