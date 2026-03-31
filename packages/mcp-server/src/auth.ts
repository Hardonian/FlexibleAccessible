import { prisma } from "@aros/db";

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

// Rate limiting per API key
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: ApiKeyRecord): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key.id);

  if (!bucket || bucket.resetAt < now) {
    const resetAt = now + 60_000;
    rateLimitBuckets.set(key.id, { count: 1, resetAt });
    return { allowed: true, remaining: key.rateLimitPerMinute - 1, resetAt };
  }

  if (bucket.count >= key.rateLimitPerMinute) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count++;
  return {
    allowed: true,
    remaining: key.rateLimitPerMinute - bucket.count,
    resetAt: bucket.resetAt,
  };
}

async function hashKey(key: string): Promise<string> {
  const crypto = await import("crypto");
  return crypto.createHash("sha256").update(key).digest("hex");
}
