import "server-only";
import { createHmac } from "node:crypto";

export class RequestError extends Error {
  constructor(public status: number, message: string, public retryAfter = 60) { super(message); }
}

const local = new Map<string, { count: number; expires: number }>();
const script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return {n,redis.call('TTL',KEYS[1])}";

// An atomic shared counter with expiring HMAC keys: no raw email/IP in Redis.
// Only local development uses memory. Production failures are closed, never bypassed.
export async function rateLimit(scope: string, identity: string, limit: number, seconds: number) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const secret = process.env.RATE_LIMIT_HMAC_KEY;
  const production = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  let count: number, ttl: number;
  if (!url || !token || !secret) {
    if (production) throw new RequestError(503, "This service is temporarily unavailable.");
    const now = Date.now();
    for (const [key, value] of local) if (value.expires <= now) local.delete(key);
    const key = `${scope}:${identity}`;
    const entry = local.get(key) ?? { count: 0, expires: now + seconds * 1000 };
    if (local.size > 10000) throw new RequestError(503, "Please try again shortly.");
    entry.count++;
    local.set(key, entry);
    count = entry.count;
    ttl = Math.ceil((entry.expires - now) / 1000);
  } else {
    try {
      const endpoint = new URL(url);
      if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || secret.length < 32) throw new Error("configuration");
      const namespace = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
      const key = `kultura:${namespace}:${scope}:${createHmac("sha256", secret).update(identity).digest("hex")}`;
      const response = await fetch(endpoint, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(["EVAL", script, "1", key, String(seconds)]),
        cache: "no-store", signal: AbortSignal.timeout(4000), redirect: "error",
      });
      if (!response.ok) throw new Error("rate backend");
      const data = await response.json() as { result?: unknown };
      if (!Array.isArray(data.result) || data.result.length !== 2 || !data.result.every(Number.isSafeInteger)) throw new Error("rate response");
      [count, ttl] = data.result as [number, number];
      if (count < 1 || ttl < 0) throw new Error("rate counter");
    } catch { throw new RequestError(503, "This service is temporarily unavailable."); }
  }
  if (count > limit) throw new RequestError(429, "Too many requests. Please try again shortly.", Math.max(1, ttl));
}
