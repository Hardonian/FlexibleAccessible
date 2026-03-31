import { getRedisClient } from '@aros/shared';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Global Rate Limiter Utility (Redis-based).
 * Use this in Next.js Server Actions or Route Handlers to protect hot paths.
 * 
 * Example:
 * const limiter = await rateLimit(`report-gen:${userId}`, 5, 60000); // 5 per minute
 * if (!limiter.success) return apiError(ApiError.tooManyRequests());
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const fullKey = `ratelimit:${key}`;
  
  const now = Date.now();
  const reset = now + windowMs;
  
  const multi = redis.multi();
  multi.zremrangebyscore(fullKey, 0, now - windowMs);
  multi.zadd(fullKey, now, now.toString());
  multi.zcard(fullKey);
  multi.pexpire(fullKey, windowMs);
  
  const results = await multi.exec();
  if (!results) throw new Error('Rate limit calculation failed');
  
  const count = results[2][1] as number;
  const remaining = Math.max(0, limit - count);
  
  return {
    success: count <= limit,
    limit,
    remaining,
    reset,
  };
}
