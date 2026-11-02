import "server-only";
import { createHmac } from "node:crypto";

export class RequestError extends Error {
  constructor(public status: number, message: string, public retryAfter = 60) { super(message); }
}

const local = new Map<string, { count: number; expires: number }>();
const script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return {n,redis.call('TTL',KEYS[1])}";

function consumeLocal(scope: string, identity: string, seconds: number) {
  const now = Date.now();
  for (const [key, value] of local) if (value.expires <= now) local.delete(key);
  const key = `${scope}:${identity}`;
  const entry = local.get(key) ?? { count: 0, expires: now + seconds * 1000 };
  if (local.size > 10000) throw new RequestError(503, "Please try again shortly.");
  entry.count++;
  local.set(key, entry);
  return { count: entry.count, ttl: Math.ceil((entry.expires - now) / 1000) };
}


// An atomic shared counter with expiring HMAC keys: no raw email/IP in Redis.
// Production mutations fail closed. Read-only cart quotes may use a bounded per-instance fallback.
export async function rateLimit(scope: string, identity: string, limit: number, seconds: number, allowLocalFallback = false) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const secret = process.env.RATE_LIMIT_HMAC_KEY;
  const production = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  let count: number, ttl: number;
  if (!url || !token || !secret) {
    if (production && !allowLocalFallback) throw new RequestError(503, "This service is temporarily unavailable.");
    ({ count, ttl } = consumeLocal(scope, identity, seconds));
  } else {
    try {
      const endpoint = new URL(url);
      if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || secret.length < 32) throw new Error("configuration");
      const projectNamespace = process.env.RATE_LIMIT_NAMESPACE;
      const environment = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
      if (!projectNamespace || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(projectNamespace) || !/^[a-z0-9_-]{1,64}$/.test(environment)) throw new Error("configuration");
      const namespace = `${projectNamespace}:${environment}`;
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
    } catch {
      if (!allowLocalFallback) throw new RequestError(503, "This service is temporarily unavailable.");
      ({ count, ttl } = consumeLocal(scope, identity, seconds));
    }
  }
  if (count > limit) throw new RequestError(429, "Too many requests. Please try again shortly.", Math.max(1, ttl));
}
