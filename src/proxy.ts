import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./lib/supabase/config";
import type { Database } from "./lib/supabase/database.types";
export async function proxy(request: NextRequest) {
    let response = NextResponse.next({ request });
    try {
        const config = supabaseConfig();
        if (config) {
            const client = createServerClient<Database>(config.url, config.key, {
                cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.SITE_URL ? process.env.SITE_URL.startsWith("https://") : process.env.NODE_ENV === "production", path: "/" },
                cookies: { getAll: () => request.cookies.getAll(), setAll: values => {
                        values.forEach(({ name, value }) => request.cookies.set(name, value));
                        response = NextResponse.next({ request });
                        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
                    } },
                global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(10000) }) }
            });
            await client.auth.getUser();
        }
    }
    catch { /* Page/action authorization still verifies identity and fails closed. */ }
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
}
export const config = { matcher: ["/account/:path*", "/admin/:path*", "/auth/:path*", "/login", "/register", "/forgot-password", "/reset-password"] };
