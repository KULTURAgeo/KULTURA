import { randomBytes } from "node:crypto";
import { contentSecurityPolicy } from "./lib/security/csp";
import { assertSameOrigin, requestIp } from "./lib/security/request";
import { rateLimit, RequestError } from "./lib/security/rate-limit";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./lib/supabase/config";
import { sessionCookieOptions } from "./lib/supabase/cookie-options";
import type { Database } from "./lib/supabase/database.types";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const EXACT_SENSITIVE_PATHS = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
]);
const SENSITIVE_PREFIXES = ["/account", "/admin", "/checkout", "/auth", "/order-confirmation"];

function isSensitivePath(pathname: string) {
  return (
    EXACT_SENSITIVE_PATHS.has(pathname) ||
    SENSITIVE_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  );
}

function isXmlMediaType(contentType: string | null) {
  if (!contentType) return false;
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return (
    mediaType === "application/xml" ||
    mediaType === "text/xml" ||
    mediaType.endsWith("+xml")
  );
}

function applySensitiveHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
}

function applyBaselineHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(self)",
  );
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const sensitive = isSensitivePath(pathname);

  // KULTURA has no XML request API. Refuse XML bodies before any application
  // parser can see them. This removes the XXE/XML-injection attack surface.
  if (
    MUTATING_METHODS.has(request.method) &&
    isXmlMediaType(request.headers.get("content-type"))
  ) {
    const blocked = new NextResponse("Unsupported Media Type", { status: 415 });
    applyBaselineHeaders(blocked);
    blocked.headers.set("Cache-Control", "no-store");
    return blocked;
  }

  if (MUTATING_METHODS.has(request.method)) {
    try {
      assertSameOrigin(request.headers);
      const length = request.headers.get("content-length");
      if (length && (!/^\d+$/.test(length) || Number(length) > 4 * 1024 * 1024)) throw new RequestError(413, "Request is too large.");
      const type = request.headers.get("content-type")?.split(";", 1)[0]?.trim();
      if (!["text/plain", "multipart/form-data", "application/x-www-form-urlencoded", "application/json"].includes(type ?? "")) throw new RequestError(415, "Unsupported Media Type");
      // Only the dedicated POST route can bypass Redis, never a Server Action.
      const logout = request.method === "POST" && pathname === "/auth/logout" && !request.headers.has("next-action");
      if (!logout) {
        await rateLimit("requests", requestIp(request.headers), 90, 60);
        if (EXACT_SENSITIVE_PATHS.has(pathname)) await rateLimit("auth-requests", requestIp(request.headers), 12, 60);
      }
    } catch (error) {
      const failure = error instanceof RequestError ? error : new RequestError(503, "Service temporarily unavailable.");
      const blocked = new NextResponse(failure.message, { status: failure.status });
      applyBaselineHeaders(blocked);
      blocked.headers.set("Cache-Control", "no-store");
      if (failure.status === 429) blocked.headers.set("Retry-After", String(failure.retryAfter));
      return blocked;
    }
  }
  const publicAsset = pathname.startsWith("/images/") || pathname.startsWith("/fonts/") ||
    ["/favicon.ico", "/icon.svg", "/apple-touch-icon.png", "/social-card.png"].includes(pathname);
  if (["GET", "HEAD"].includes(request.method) && publicAsset) {
    const asset = NextResponse.next();
    applyBaselineHeaders(asset);
    return asset;
  }
  const nonce = randomBytes(24).toString("base64");
  const policy = contentSecurityPolicy(nonce, request.nextUrl.protocol === "https:");
  request.headers.set("x-nonce", nonce);
  request.headers.set("x-kultura-pathname", pathname);
  request.headers.set("Content-Security-Policy", policy);
  let response = NextResponse.next({ request });

  // Session refresh is only needed on authentication and privileged surfaces.
  // Authorization is still re-checked by the page/server action and fails closed.
  if (sensitive) {
    try {
      const config = supabaseConfig();
      if (config) {
        const client = createServerClient<Database>(config.url, config.key, {
          cookieOptions: sessionCookieOptions(
            request.nextUrl.protocol === "https:" || process.env.VERCEL === "1",
          ),
          cookies: {
            getAll: () => request.cookies.getAll(),
            setAll: (values, headers) => {
              values.forEach(({ name, value }) => request.cookies.set(name, value));
              const previous = response;
              response = NextResponse.next({ request });
              previous.cookies
                .getAll()
                .forEach((cookie) => response.cookies.set(cookie));
              previous.headers.forEach((value, key) => {
                if (["cache-control", "expires", "pragma"].includes(key))
                  response.headers.set(key, value);
              });
              Object.entries(headers).forEach(([key, value]) =>
                response.headers.set(key, value),
              );
              values.forEach(({ name, value, options }) =>
                response.cookies.set(name, value, options),
              );
            },
          },
          global: {
            fetch: (input, init) =>
              fetch(input, {
                ...init,
                cache: "no-store",
                signal: AbortSignal.timeout(10000),
              }),
          },
        });
        await client.auth.getClaims();
      }
    } catch {
      // Page/action authorization still verifies identity and fails closed.
    }

    applySensitiveHeaders(response);
  }

  applyBaselineHeaders(response);
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
