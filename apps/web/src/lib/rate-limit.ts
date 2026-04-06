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

/**
 * Same as {@link rateLimit}, but never throws. On Redis errors we allow the
 * request (degraded: limits not enforced) and log loudly—operators should
 * treat Redis health as part of abuse posture.
 */
export async function rateLimitSafe(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  try {
    return await rateLimit(key, limit, windowMs);
  } catch (e) {
    console.error('[rate-limit] Redis failure; limiter degraded (request allowed)', e);
    const reset = Date.now() + windowMs;
    return { success: true, limit, remaining: limit, reset };
  }
}
