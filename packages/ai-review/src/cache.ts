import { createHash } from "crypto";
import { getRedisClient } from "@aros/shared";

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const CACHE_PREFIX = "ai-review:";

/**
 * Generate a cache key from DOM content and viewport width.
 */
export function generateCacheKey(
  domSnapshot: string,
  viewportWidth: number,
): string {
  const hash = createHash("sha256")
    .update(`${domSnapshot.slice(0, 5000)}:${viewportWidth}`)
    .digest("hex");
  return `${CACHE_PREFIX}${hash}`;
}

/**
 * Get a cached review result by key.
 * Returns null if not found or on Redis error.
 */
export async function getCachedReview<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedisClient();
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Store a review result in cache.
 * Fire-and-forget — does not throw on Redis error.
 */
export async function setCachedReview<T>(key: string, value: T): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.set(key, JSON.stringify(value), "EX", CACHE_TTL_SECONDS);
  } catch (err) {
    console.warn("[AiReview] Cache write failed:", err);
  }
}
