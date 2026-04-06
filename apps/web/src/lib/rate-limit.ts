import { abuseRateLimit } from '@aros/shared';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  /** True when Redis was unavailable; limits are per-process only. */
  abuseControlDegraded?: boolean;
}

/**
 * Sliding-window limiter (Redis when available; per-process fallback when not).
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const outcome = await abuseRateLimit(`ratelimit:${key}`, limit, windowMs);
  return {
    success: outcome.allowed,
    limit,
    remaining: outcome.remaining,
    reset: outcome.resetAt,
    abuseControlDegraded: outcome.degraded,
  };
}
