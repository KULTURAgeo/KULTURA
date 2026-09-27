import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabaseConfig } from "./config";

function isServiceRoleKey(key: string) {
  if (key.startsWith("sb_secret_") && key.length > 20) return true;
  if (!key.startsWith("eyJ")) return false;
  try {
    const claims: unknown = JSON.parse(
      Buffer.from(key.split(".")[1] ?? "", "base64url").toString(),
    );
    return (
      typeof claims === "object" &&
      claims !== null &&
      "role" in claims &&
      claims.role === "service_role"
    );
  } catch {
    return false;
  }
}

export function createAdminClient() {
  const config = supabaseConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !key) return null;
  if (!isServiceRoleKey(key))
    throw new Error("Invalid Supabase service-role configuration.");
  return createClient<Database>(config.url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        }),
    },
  });
}
