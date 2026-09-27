"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { sessionCookieOptions } from "./cookie-options";

export type PublicAuthConfig = { url: string; key: string };
export function createBrowserSessionClient(config: PublicAuthConfig) {
  return createBrowserClient<Database>(config.url, config.key, {
    cookieOptions: sessionCookieOptions(window.location.protocol === "https:"),
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
}
