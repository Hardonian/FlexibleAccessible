import { prisma } from "@aros/db";
import { abuseRateLimit } from "@aros/shared";

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

const RATE_LIMIT_WINDOW_MS = 60_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  /** When true, limits are not synchronized across instances. */
  degraded: boolean;
}

/**
 * Per-API-key sliding window. Uses Redis when healthy; otherwise a bounded per-process window.
 */
export async function checkRateLimit(
  key: ApiKeyRecord,
): Promise<RateLimitResult> {
  const outcome = await abuseRateLimit(
    `mcp-api:${key.id}`,
    key.rateLimitPerMinute,
    RATE_LIMIT_WINDOW_MS,
  );
  return {
    allowed: outcome.allowed,
    remaining: outcome.remaining,
    resetAt: outcome.resetAt,
    degraded: outcome.degraded,
  };
}

async function hashKey(key: string): Promise<string> {
  const crypto = await import("crypto");
  return crypto.createHash("sha256").update(key).digest("hex");
}
