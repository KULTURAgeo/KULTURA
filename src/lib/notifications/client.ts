import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "../supabase/config";
import type { Database } from "../supabase/database.types";

// A dedicated backend client, never part of layout props or browser configuration.
// It is used only after the originating action has authorized the order operation.
export function notificationClient() {
  const config = supabaseConfig();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!config || !key) return null;
  return createClient<Database>(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(10000) }) },
  });
}
