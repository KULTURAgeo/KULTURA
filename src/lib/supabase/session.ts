import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseConfig } from "./config";
import type { Database } from "./database.types";
export async function createSessionClient(writable = false) {
    const config = supabaseConfig();
    if (!config)
        return null;
    const jar = await cookies();
    return createServerClient<Database>(config.url, config.key, {
        cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.SITE_URL ? process.env.SITE_URL.startsWith("https://") : process.env.NODE_ENV === "production", path: "/" },
        cookies: { getAll: () => jar.getAll(), setAll: values => { if (writable)
                values.forEach(({ name, value, options }) => jar.set(name, value, options)); } },
        global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(15000) }) }
    });
}
