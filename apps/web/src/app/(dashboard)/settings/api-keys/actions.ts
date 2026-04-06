"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requireOrgAccess } from "@/lib/auth-guard";
import { ApiError } from "@aros/shared";
import { hasPermission } from "@aros/config";
import crypto from "node:crypto";
import { logProductEvent, PRODUCT_EVENT_ACTIONS } from "@/lib/product-events";

const API_KEY_PREFIX = "arsk_live_";
const KEY_BYTES = 32; // 64 hex chars

function redirectApiKeysQuery(params: Record<string, string>): never {
  const q = new URLSearchParams(params).toString();
  redirect(`/settings/api-keys?${q}` as Route);
}

/**
 * Generate a secure random API key with SHA-256 hash for storage.
 * Returns the plaintext key and its hash.
 */
async function generateApiKey(): Promise<{ plaintext: string; hash: string }> {
  const randomBytes = crypto.randomBytes(KEY_BYTES);
  const plaintext = API_KEY_PREFIX + randomBytes.toString("hex");
  const hash = crypto.createHash("sha256").update(plaintext).digest("hex");
  return { plaintext, hash };
}

interface CreateKeyState {
  success: boolean;
  error: string | null;
  key?: {
    id: string;
    name: string;
    plaintext: string;
    expiresAt: string | null;
    scopes: string[];
    rateLimitPerMinute: number;
  };
}

/**
 * Rate limiting: Track key creation attempts in process memory.
 * In production, this should use Redis or similar.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, orgId: string): boolean {
  const key = `${userId}:${orgId}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 10;

  const entry = rateLimitMap.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

export async function createApiKeyAction(
  _prevState: CreateKeyState,
  formData: FormData,
): Promise<CreateKeyState> {
  const user = await requireSession();
  const organizationId = (formData.get("organizationId") as string) ?? "";
  const name = (formData.get("name") as string)?.trim() ?? "";
  const scopesRaw = (formData.get("scopes") as string) ?? "";
  const rateLimitRaw = (formData.get("rateLimitPerMinute") as string) ?? "60";
  const expiresAtRaw = (formData.get("expiresAt") as string) ?? "";

  // Validation
  if (!name) {
    return { success: false, error: "API key name is required" };
  }

  if (name.length > 100) {
    return {
      success: false,
      error: "API key name must be 100 characters or less",
    };
  }

  const rateLimitPerMinute = parseInt(rateLimitRaw, 10);
  if (
    isNaN(rateLimitPerMinute) ||
    rateLimitPerMinute < 1 ||
    rateLimitPerMinute > 10000
  ) {
    return {
      success: false,
      error: "Rate limit must be between 1 and 10,000 requests per minute",
    };
  }

  let scopes: string[] = [];
  if (scopesRaw) {
    try {
      scopes = JSON.parse(scopesRaw);
      if (!Array.isArray(scopes) || scopes.length === 0) {
        return { success: false, error: "At least one scope is required" };
      }
    } catch {
      return { success: false, error: "Invalid scopes format" };
    }
  }

  let expiresAt: Date | null = null;
  if (expiresAtRaw) {
    const parsed = new Date(expiresAtRaw);
    if (isNaN(parsed.getTime())) {
      return { success: false, error: "Invalid expiration date" };
    }
    // Must be in the future
    if (parsed < new Date()) {
      return { success: false, error: "Expiration date must be in the future" };
    }
    expiresAt = parsed;
  }

  // Permission check - only ADMIN and OWNER can manage API keys
  const ctx = await requireOrgAccess(organizationId);
  if (!hasPermission(ctx.role, "integrations:manage")) {
    return {
      success: false,
      error: "Only admins and owners can manage API keys",
    };
  }

  // Rate limiting
  if (!checkRateLimit(user.id, organizationId)) {
    return {
      success: false,
      error: "Too many requests. Please wait before creating another key.",
    };
  }

  // Generate the key
  const { plaintext, hash } = await generateApiKey();

  try {
    const apiKey = await prisma.apiKey.create({
      data: {
        organizationId,
        keyHash: hash,
        name,
        scopes,
        rateLimitPerMinute,
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        scopes: true,
        rateLimitPerMinute: true,
        expiresAt: true,
      },
    });

    revalidatePath("/settings/api-keys");

    await logProductEvent({
      organizationId,
      userId: user.id,
      action: PRODUCT_EVENT_ACTIONS.api_key_created,
      metadata: { keyId: apiKey.id, name: apiKey.name },
    });

    return {
      success: true,
      error: null,
      key: {
        id: apiKey.id,
        name: apiKey.name,
        plaintext,
        scopes: apiKey.scopes as string[],
        rateLimitPerMinute: apiKey.rateLimitPerMinute,
        expiresAt: apiKey.expiresAt?.toISOString() ?? null,
      },
    };
  } catch (error) {
    console.error("[api-keys] create error:", error);
    return {
      success: false,
      error: "Failed to create API key. Please try again.",
    };
  }
}

interface RotateKeyState {
  success: boolean;
  error: string | null;
  key?: {
    id: string;
    name: string;
    plaintext: string;
  };
}

export async function rotateApiKeyAction(
  _prevState: RotateKeyState,
  formData: FormData,
): Promise<RotateKeyState> {
  const user = await requireSession();
  const organizationId = (formData.get("organizationId") as string) ?? "";
  const keyId = (formData.get("keyId") as string) ?? "";

  if (!keyId) {
    return { success: false, error: "API key ID is required" };
  }

  // Permission check
  const ctx = await requireOrgAccess(organizationId);
  if (!hasPermission(ctx.role, "integrations:manage")) {
    return {
      success: false,
      error: "Only admins and owners can rotate API keys",
    };
  }

  // Rate limiting
  if (!checkRateLimit(user.id, organizationId)) {
    return {
      success: false,
      error: "Too many requests. Please wait before rotating another key.",
    };
  }

  // Verify key exists and belongs to this organization
  const existingKey = await prisma.apiKey.findFirst({
    where: {
      id: keyId,
      organizationId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      scopes: true,
      rateLimitPerMinute: true,
      expiresAt: true,
    },
  });

  if (!existingKey) {
    return { success: false, error: "API key not found or already revoked" };
  }

  // Generate new key
  const { plaintext, hash } = await generateApiKey();

  try {
    // Delete old key and create new one with same settings in a transaction
    const [newKey] = await prisma.$transaction([
      prisma.apiKey.create({
        data: {
          organizationId,
          keyHash: hash,
          name: existingKey.name,
          scopes: existingKey.scopes as string[],
          rateLimitPerMinute: existingKey.rateLimitPerMinute,
          expiresAt: existingKey.expiresAt,
        },
      }),
      prisma.apiKey.delete({
        where: { id: keyId },
      }),
    ]);

    revalidatePath("/settings/api-keys");

    return {
      success: true,
      error: null,
      key: {
        id: newKey.id,
        name: newKey.name,
        plaintext,
      },
    };
  } catch (error) {
    console.error("[api-keys] rotate error:", error);
    return {
      success: false,
      error: "Failed to rotate API key. Please try again.",
    };
  }
}

export async function revokeApiKeyAction(formData: FormData): Promise<void> {
  const organizationId = (formData.get("organizationId") as string) ?? "";
  const keyId = (formData.get("keyId") as string) ?? "";

  if (!keyId) {
    redirectApiKeysQuery({ error: "API key ID is required" });
  }

  // Permission check
  const ctx = await requireOrgAccess(organizationId);
  if (!hasPermission(ctx.role, "integrations:manage")) {
    redirectApiKeysQuery({
      error: "Only admins and owners can revoke API keys",
    });
  }

  // Soft delete by setting isActive to false
  try {
    const key = await prisma.apiKey.findFirst({
      where: {
        id: keyId,
        organizationId,
        isActive: true,
      },
    });

    if (!key) {
      redirectApiKeysQuery({
        error: "API key not found or already revoked",
      });
    }

    await prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });

    revalidatePath("/settings/api-keys");
    redirectApiKeysQuery({ status: "revoked" });
  } catch (error) {
    if (error instanceof ApiError) {
      redirectApiKeysQuery({ error: error.message });
    }
    redirectApiKeysQuery({ error: "Failed to revoke API key" });
  }
}

/**
 * Get usage stats for an API key - exported for use in page.tsx
 */
export async function getApiKeyUsageStats(organizationId: string) {
  const ctx = await requireOrgAccess(organizationId);
  if (!hasPermission(ctx.role, "integrations:manage")) {
    throw ApiError.forbidden("Only admins and owners can view API key usage");
  }

  const keys = await prisma.apiKey.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    include: {
      mcpUsageLogs: {
        select: {
          id: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return keys.map((key) => ({
    id: key.id,
    name: key.name,
    scopes: key.scopes as string[],
    rateLimitPerMinute: key.rateLimitPerMinute,
    isActive: key.isActive,
    lastUsedAt: key.lastUsedAt,
    expiresAt: key.expiresAt,
    createdAt: key.createdAt,
    totalCalls: key.mcpUsageLogs.length,
  }));
}
