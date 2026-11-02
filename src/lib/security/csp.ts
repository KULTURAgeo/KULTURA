export function contentSecurityPolicy(nonce: string, secure: boolean) {
  const dev = process.env.NODE_ENV === "development";
  let storage = "";
  try { storage = new URL(process.env.SUPABASE_URL ?? "").origin; } catch { /* Unconfigured catalog. */ }
  const google = /^G-[A-Z0-9]+$/.test(process.env.GOOGLE_ANALYTICS_ID ?? "");
  const meta = /^\d+$/.test(process.env.META_PIXEL_ID ?? "");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "script-src-attr 'none'",
    // Existing React/anime.js positioning and transforms require style attributes.
    // Scripts never use unsafe-inline. Style elements require a nonce in modern browsers.
    "style-src 'self' 'unsafe-inline'",
    `style-src-elem 'self' ${dev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' data: blob: ${storage}${google ? " https://www.google-analytics.com" : ""}${meta ? " https://www.facebook.com" : ""}`,
    "font-src 'self'",
    `connect-src 'self' ${storage}${dev ? " ws: wss:" : ""}${google ? " https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com https://www.googletagmanager.com" : ""}${meta ? " https://www.facebook.com https://connect.facebook.net" : ""}`,
    `frame-src ${meta ? "https://www.facebook.com" : "'none'"}`,
    "media-src 'self'", "worker-src 'self' blob:", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
    ...(secure ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
