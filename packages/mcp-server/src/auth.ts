import { prisma } from "@aros/db";
import { abuseRateLimit } from "@aros/shared";
import bcrypt from "bcrypt";

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

  const activeKeys = await prisma.apiKey.findMany({
    where: { isActive: true },
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

  for (const dbKey of activeKeys) {
    const cached = keyCache.get(dbKey.id);
    if (cached && cached.expiresAt > Date.now()) {
      if (await bcrypt.compare(apiKey, dbKey.keyHash)) return cached.record;
      continue;
    }

    if (await bcrypt.compare(apiKey, dbKey.keyHash)) {
      const record: ApiKeyRecord = {
        id: dbKey.id,
        organizationId: dbKey.organizationId,
        keyHash: dbKey.keyHash,
        name: dbKey.name,
        scopes: dbKey.scopes as string[],
        rateLimitPerMinute: dbKey.rateLimitPerMinute,
        isActive: dbKey.isActive,
      };

      keyCache.set(dbKey.id, { record, expiresAt: Date.now() + CACHE_TTL_MS });
      return record;
    }
  }

  return null;
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


