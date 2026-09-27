import "server-only";
import {siteUrl} from "../site";
export function supabaseConfig() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url && !key)
        return null;
    if (!url || !key)
        throw new Error("Incomplete Supabase catalog configuration.");
    const parsed = new URL(url);
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash || (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))))
        throw new Error("Invalid Supabase URL.");
    let allowed = key.startsWith("sb_publishable_");
    if (!allowed && key.startsWith("eyJ")) {
        try {
            const claims: unknown = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString());
            allowed = typeof claims === "object" && claims !== null && "role" in claims && claims.role === "anon";
        }
        catch {
            allowed = false;
        }
    }
    if (!allowed)
        throw new Error("The catalog requires a publishable or legacy anon key.");
    return { url: parsed.origin, key };
}
export function siteOrigin() {
    const configured = process.env.SITE_URL;
    if (!configured)
        throw new Error("SITE_URL is required for authentication emails.");
    return siteUrl().origin;
}
