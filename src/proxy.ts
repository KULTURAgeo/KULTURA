import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./lib/supabase/config";
import { sessionCookieOptions } from "./lib/supabase/cookie-options";
import type { Database } from "./lib/supabase/database.types";
export async function proxy(request: NextRequest) {
    let response = NextResponse.next({ request });
    try {
        const config = supabaseConfig();
        if (config) {
            const client = createServerClient<Database>(config.url, config.key, {
                cookieOptions: sessionCookieOptions(request.nextUrl.protocol === "https:" || process.env.VERCEL === "1"),
                cookies: { getAll: () => request.cookies.getAll(), setAll: (values, headers) => {
                        values.forEach(({ name, value }) => request.cookies.set(name, value));
                        const previous = response;
                        response = NextResponse.next({ request });
                        previous.cookies.getAll().forEach(cookie => response.cookies.set(cookie));
                        previous.headers.forEach((value, key) => { if (["cache-control", "expires", "pragma"].includes(key)) response.headers.set(key, value); });
                        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
                        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
                    } },
                global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(10000) }) }
            });
            await client.auth.getClaims();
        }
    }
    catch { /* Page/action authorization still verifies identity and fails closed. */ }
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
}
export const config = { matcher: ["/account/:path*", "/admin/:path*", "/auth/:path*", "/login", "/register", "/forgot-password", "/reset-password", "/checkout/:path*", "/api/checkout"] };
