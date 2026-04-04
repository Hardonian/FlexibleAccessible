import { prisma } from "@aros/db";
import { getRedisClient } from "@aros/shared";
import { authLogger } from "@aros/shared";

export interface ApiKeyRecord {
  id: string;
  organizationId: string;
  keyHash: string;
  name: string;
  scopes: string[];
  rateLimitPerMinute: number;
  isActive: boolean;
}

const keyCache = new Map<string, { record: ApiKeyRecord; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

export async function validateApiKey(
  apiKey: string,
): Promise<ApiKeyRecord | null> {
  if (!apiKey) return null;

  const keyHash = await hashKey(apiKey);
  const cached = keyCache.get(keyHash);
  if (cached && cached.expiresAt > Date.now()) return cached.record;

  const dbKey = await prisma.apiKey.findUnique({
    where: { keyHash, isActive: true },
    select: {
      id: true,
      organizationId: true,
      keyHash: true,
      name: true,
      scopes: true,
      rateLimitPerMinute: true,
      isActive: true,
    },
  });

  if (!dbKey) return null;

  const record: ApiKeyRecord = {
    id: dbKey.id,
    organizationId: dbKey.organizationId,
    keyHash: dbKey.keyHash,
    name: dbKey.name,
    scopes: dbKey.scopes as string[],
    rateLimitPerMinute: dbKey.rateLimitPerMinute,
    isActive: dbKey.isActive,
  };

  keyCache.set(keyHash, { record, expiresAt: Date.now() + CACHE_TTL_MS });
  return record;
}

export function hasScope(key: ApiKeyRecord, scope: string): boolean {
  return key.scopes.includes("*") || key.scopes.includes(scope);
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute sliding window

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for an API key using Redis sliding window.
 * @param key - The API key record
 * @returns Rate limit result indicating if request is allowed and remaining quota
 */
export async function checkRateLimit(
  key: ApiKeyRecord,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const resetAt = now + RATE_LIMIT_WINDOW_MS;

  const redisKey = `rate_limit:${key.id}`;

  try {
    const redis = getRedisClient();

    // Multi-command for atomic operations:
    // 1. Remove expired entries (outside window)
    // 2. Add current request timestamp
    // 3. Set expiry on the key
    // 4. Count current requests in window
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(redisKey, 0, windowStart);
    pipeline.zadd(redisKey, now, `${now}:${Math.random()}`);
    pipeline.pexpire(redisKey, RATE_LIMIT_WINDOW_MS);
    pipeline.zcard(redisKey);

    const results = await pipeline.exec();
    if (!results) {
      throw new Error("Redis pipeline returned null");
    }

    // results is an array of [error, result] tuples
    const [, countResult] = results[3];
    const count = countResult as number;

    const remaining = Math.max(0, key.rateLimitPerMinute - count);
    const allowed = count <= key.rateLimitPerMinute;

    return { allowed, remaining, resetAt };
  } catch (error) {
    // Fail open: log warning and allow request when Redis is unavailable
    authLogger.warn("Rate limiting Redis unavailable, failing open", {
      userId: key.id,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      allowed: true,
      remaining: key.rateLimitPerMinute,
      resetAt,
    };
  }
}

async function hashKey(key: string): Promise<string> {
  const crypto = await import("crypto");
  return crypto.createHash("sha256").update(key).digest("hex");
}
