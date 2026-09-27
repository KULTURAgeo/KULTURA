import type { CookieOptions } from "@supabase/ssr";

// Browser and server clients must share the same host-only cookie contract.
// HttpOnly is incompatible with createBrowserClient's cookie storage.
export function sessionCookieOptions(secure: boolean): CookieOptions {
  return { path: "/", sameSite: "lax", secure, httpOnly: false };
}
