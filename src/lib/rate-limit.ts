/**
 * In-memory fixed-window rate limiter.
 *
 * NOTE: state lives in the process, so limits are per-instance. It is good
 * enough for local development and a single-instance demo; PRD section 18
 * requires persistent rate limiting before production, which will replace
 * this with a database-backed implementation in a later milestone.
 */

type Bucket = { remaining: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitOptions = {
  /** Max requests allowed per window. */
  limit: number;
  /** Window size in milliseconds. */
  windowMs: number;
};

/** Returns true when the request is allowed, false when it is rate limited. */
export function rateLimit(key: string, options: RateLimitOptions): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { remaining: options.limit - 1, resetAt: now + options.windowMs });
    return true;
  }

  if (bucket.remaining <= 0) return false;
  bucket.remaining -= 1;
  return true;
}

/** Test helper: clear all buckets. */
export function resetRateLimits(): void {
  buckets.clear();
}
