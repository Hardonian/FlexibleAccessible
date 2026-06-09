import { getRedisClient } from "./redis-connection.js";
import { authLogger } from "./logger.js";
import { randomUUID } from "node:crypto";

export type AbuseRateLimitMode = "redis" | "memory_fallback" | "redis_unavailable_strict";

export interface AbuseRateLimitOutcome {
  allowed: boolean;
  /** True when Redis could not be used; operators should treat abuse posture as degraded. */
  degraded: boolean;
  mode: AbuseRateLimitMode;
  remaining: number;
  resetAt: number;
}

const memoryBuckets = new Map<
  string,
  { timestamps: number[]; windowMs: number }
>();

function pruneAndCount(timestamps: number[], now: number, windowMs: number): number {
  const cutoff = now - windowMs;
  while (timestamps.length > 0 && timestamps[0]! < cutoff) {
    timestamps.shift();
  }
  return timestamps.length;
}

/**
 * Sliding-window limiter: prefers Redis for cross-instance consistency.
 * When Redis errors, uses a per-process in-memory window (bounded, not globally accurate).
 */
export async function abuseRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<AbuseRateLimitOutcome> {
  const now = Date.now();
  const resetAt = now + windowMs;
  const fullKey = `abuse:${key}`;

  try {
    const redis = getRedisClient();
    const multi = redis.multi();
    multi.zremrangebyscore(fullKey, 0, now - windowMs);
    multi.zadd(fullKey, now, `${now}:${randomUUID()}`);
    multi.zcard(fullKey);
    multi.pexpire(fullKey, windowMs);

    const results = await multi.exec();
    if (!results) {
      throw new Error("Redis multi returned null");
    }
    const count = results[2]![1] as number;
    const remaining = Math.max(0, limit - count);
    return {
      allowed: count <= limit,
      degraded: false,
      mode: "redis",
      remaining,
      resetAt,
    };
  } catch (e) {
    authLogger.warn("Abuse rate limit: Redis unavailable, using in-process fallback", {
      metadata: { keyPrefix: key.slice(0, 32) },
      error: e instanceof Error ? e.message : String(e),
    });

    let bucket = memoryBuckets.get(fullKey);
    if (!bucket || bucket.windowMs !== windowMs) {
      bucket = { timestamps: [], windowMs };
      memoryBuckets.set(fullKey, bucket);
    }
    const count = pruneAndCount(bucket.timestamps, now, windowMs);
    if (count >= limit) {
      return {
        allowed: false,
        degraded: true,
        mode: "redis_unavailable_strict",
        remaining: 0,
        resetAt,
      };
    }
    bucket.timestamps.push(now);
    return {
      allowed: true,
      degraded: true,
      mode: "memory_fallback",
      remaining: Math.max(0, limit - count - 1),
      resetAt,
    };
  }
}
