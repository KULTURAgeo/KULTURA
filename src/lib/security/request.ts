import "server-only";
import { headers } from "next/headers";
import { isIP } from "node:net";
import { rateLimit, RequestError } from "./rate-limit";

export function assertSameOrigin(values: Headers) {
  const raw = values.get("origin");
  let origin: URL;
  try { origin = new URL(raw ?? ""); } catch { throw new RequestError(403, "Please reload the page and try again."); }
  const trusted = [process.env.SITE_URL, process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`, process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`]
    .filter((value): value is string => !!value)
    .map((value) => { try { return new URL(value).origin; } catch { return ""; } });
  const local = process.env.VERCEL !== "1" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) && origin.host === values.get("host");
  if (raw !== origin.origin || (!trusted.includes(origin.origin) && !local) || values.get("sec-fetch-site") === "cross-site")
    throw new RequestError(403, "Please reload the page and try again.");
}

export function requestIp(values: Headers) {
  // Vercel overwrites x-forwarded-for at its edge. Never trust it on another host.
  if (process.env.VERCEL !== "1") return "local";
  const candidate = values.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  return isIP(candidate) ? candidate : "unknown";
}

export async function protectAction(scope = "action", identity?: string) {
  const values = await headers();
  assertSameOrigin(new Headers(values));
  await rateLimit(scope, identity ?? requestIp(new Headers(values)), scope === "auth" ? 12 : 90, 60);
}
