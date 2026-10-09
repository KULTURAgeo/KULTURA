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
const SENSITIVE_PREFIXES = ["/account", "/admin", "/checkout", "/auth"];

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
        // The proxy refreshes cookies, but NEVER grants access based on
        // getSession(). Page and action guards still verify getUser() and
        // fetch the current role from the database on every protected request.
        // Avoid duplicate Auth verification during routine navigation.
        await client.auth.getSession();
      }
    } catch {
      // Page/action authorization still verifies identity and fails closed.
    }

    applySensitiveHeaders(response);
  }

  applyBaselineHeaders(response);
  return response;
}

export const config = {
  // Run on application routes so hostile XML bodies are rejected globally,
  // while avoiding static assets and Next.js image/static delivery paths.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|css|js|map|woff|woff2)$).*)",
  ],
};
