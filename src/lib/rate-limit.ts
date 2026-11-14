import "server-only";

import { headers } from "next/headers";

/**
 * Fixed-window rate limiter held in process memory.
 *
 * Deliberately simple. It stops the obvious abuse — credential stuffing on the
 * login form, a script hammering recommendation creation — without adding Redis
 * to the stack. The trade-off is real and worth stating: counters are per
 * instance, so behind several servers the effective limit multiplies by the
 * instance count, and a restart clears them. Move to Redis or the database
 * before running more than one instance.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Keep the map from growing without bound on a long-lived process.
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitRule = { limit: number; windowMs: number };

export const RATE_LIMITS = {
  login: { limit: 8, windowMs: 10 * 60_000 },
  signup: { limit: 5, windowMs: 60 * 60_000 },
  recommendation: { limit: 40, windowMs: 60 * 60_000 },
  claim: { limit: 5, windowMs: 60 * 60_000 },
  connection: { limit: 30, windowMs: 60 * 60_000 },
  ask: { limit: 10, windowMs: 60 * 60_000 },
  import: { limit: 5, windowMs: 60 * 60_000 },
  help: { limit: 25, windowMs: 60 * 60_000 },
  edu: { limit: 5, windowMs: 60 * 60_000 },
  eduConfirm: { limit: 15, windowMs: 60 * 60_000 },
  college: { limit: 5, windowMs: 60 * 60_000 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/** Best-effort client identity. Falls back to a shared bucket behind proxies. */
export async function clientKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function check(
  name: RateLimitName,
  identifier: string,
): RateLimitResult {
  const rule = RATE_LIMITS[name];
  const now = Date.now();
  sweep(now);

  const key = `${name}:${identifier}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { ok: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= rule.limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: rule.limit - existing.count,
    retryAfterSeconds: 0,
  };
}

/**
 * Checks the limit for the calling request. Pass an extra `scope` (an email, a
 * user id) to bucket per account as well as per IP.
 */
export async function rateLimit(name: RateLimitName, scope?: string) {
  const ip = await clientKey();
  return check(name, scope ? `${ip}|${scope}` : ip);
}

export function rateLimitMessage(result: RateLimitResult) {
  const minutes = Math.ceil(result.retryAfterSeconds / 60);
  return `Too many attempts. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`;
}
