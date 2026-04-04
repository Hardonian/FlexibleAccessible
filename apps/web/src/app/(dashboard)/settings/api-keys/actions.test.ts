import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createApiKeyAction,
  revokeApiKeyAction,
  rotateApiKeyAction,
  getApiKeyUsageStats,
} from "./actions";

vi.mock("@/lib/db", () => ({
  prisma: {
    apiKey: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/auth-guard", () => ({
  requireOrgAccess: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requireOrgAccess } from "@/lib/auth-guard";
import { redirect } from "next/navigation";

describe("createApiKeyAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue({
      id: "user_123",
      email: "admin@example.com",
      name: "Admin User",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates API key with valid inputs", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_123", email: "admin@example.com", name: "Admin User" },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.apiKey.create).mockResolvedValue({
      id: "key_123",
      name: "Test Key",
      scopes: ["sites:read", "scan:read"],
      rateLimitPerMinute: 60,
      expiresAt: null,
    } as any);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("name", "Test Key");
    formData.set("scopes", JSON.stringify(["sites:read", "scan:read"]));
    formData.set("rateLimitPerMinute", "60");

    const result = await createApiKeyAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
    expect(result.key).toBeDefined();
    expect(result.key?.name).toBe("Test Key");
    expect(result.key?.plaintext).toMatch(/^arsk_live_[a-f0-9]{64}$/);
    expect(result.key?.scopes).toEqual(["sites:read", "scan:read"]);
    expect(prisma.apiKey.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org_123",
        name: "Test Key",
        scopes: ["sites:read", "scan:read"],
        rateLimitPerMinute: 60,
        expiresAt: null,
      }),
      select: expect.any(Object),
    });
  });

  it("rejects empty name", async () => {
    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("name", "");
    formData.set("scopes", JSON.stringify(["sites:read"]));

    const result = await createApiKeyAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("API key name is required");
    expect(prisma.apiKey.create).not.toHaveBeenCalled();
  });

  it("rejects name over 100 characters", async () => {
    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("name", "a".repeat(101));
    formData.set("scopes", JSON.stringify(["sites:read"]));

    const result = await createApiKeyAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("API key name must be 100 characters or less");
  });

  it("rejects invalid rate limit", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_123", email: "admin@example.com", name: "Admin User" },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("name", "Test Key");
    formData.set("scopes", JSON.stringify(["sites:read"]));
    formData.set("rateLimitPerMinute", "0");

    const result = await createApiKeyAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "Rate limit must be between 1 and 10,000 requests per minute",
    );
  });

  it("rejects rate limit over 10000", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_123", email: "admin@example.com", name: "Admin User" },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("name", "Test Key");
    formData.set("scopes", JSON.stringify(["sites:read"]));
    formData.set("rateLimitPerMinute", "10001");

    const result = await createApiKeyAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "Rate limit must be between 1 and 10,000 requests per minute",
    );
  });

  it("rejects empty scopes array", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_123", email: "admin@example.com", name: "Admin User" },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("name", "Test Key");
    formData.set("scopes", JSON.stringify([]));

    const result = await createApiKeyAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("At least one scope is required");
  });

  it("rejects invalid scopes JSON", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_123", email: "admin@example.com", name: "Admin User" },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("name", "Test Key");
    formData.set("scopes", "invalid json");

    const result = await createApiKeyAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid scopes format");
  });

  it("rejects past expiration date", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_123", email: "admin@example.com", name: "Admin User" },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("name", "Test Key");
    formData.set("scopes", JSON.stringify(["sites:read"]));
    formData.set("expiresAt", "2020-01-01");

    const result = await createApiKeyAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Expiration date must be in the future");
  });

  it("rejects for DEVELOPER role (permission check)", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_123", email: "dev@example.com", name: "Dev User" },
      organizationId: "org_123",
      role: "DEVELOPER",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("name", "Test Key");
    formData.set("scopes", JSON.stringify(["sites:read"]));

    const result = await createApiKeyAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Only admins and owners can manage API keys");
    expect(prisma.apiKey.create).not.toHaveBeenCalled();
  });

  it("allows OWNER role to create keys", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_123", email: "owner@example.com", name: "Owner User" },
      organizationId: "org_123",
      role: "OWNER",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.apiKey.create).mockResolvedValue({
      id: "key_123",
      name: "Test Key",
      scopes: ["sites:read"],
      rateLimitPerMinute: 60,
      expiresAt: null,
    } as any);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("name", "Test Key");
    formData.set("scopes", JSON.stringify(["sites:read"]));

    const result = await createApiKeyAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(true);
    expect(prisma.apiKey.create).toHaveBeenCalled();
  });

  it("enforces tenant isolation via requireOrgAccess", async () => {
    vi.mocked(requireOrgAccess).mockRejectedValue(
      new Error("You do not have access to this organization"),
    );

    const formData = new FormData();
    formData.set("organizationId", "org_other");
    formData.set("name", "Test Key");
    formData.set("scopes", JSON.stringify(["sites:read"]));

    await expect(
      createApiKeyAction({ success: false, error: null }, formData),
    ).rejects.toThrow("You do not have access to this organization");
  });
});

describe("revokeApiKeyAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("revokes active API key", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_123", email: "admin@example.com", name: "Admin User" },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.apiKey.findFirst).mockResolvedValue({
      id: "key_123",
      organizationId: "org_123",
      isActive: true,
    } as any);

    vi.mocked(prisma.apiKey.update).mockResolvedValue({} as any);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("keyId", "key_123");

    await revokeApiKeyAction(formData);

    expect(prisma.apiKey.update).toHaveBeenCalledWith({
      where: { id: "key_123" },
      data: { isActive: false },
    });
    expect(redirect).toHaveBeenCalledWith("/settings/api-keys?status=revoked");
  });

  it("returns error when key not found", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_123", email: "admin@example.com", name: "Admin User" },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.apiKey.findFirst).mockResolvedValue(null);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("keyId", "key_nonexistent");

    await revokeApiKeyAction(formData);

    expect(redirect).toHaveBeenCalledWith(
      "/settings/api-keys?error=" +
        encodeURIComponent("API key not found or already revoked"),
    );
  });

  it("rejects for DEVELOPER role", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_123", email: "dev@example.com", name: "Dev User" },
      organizationId: "org_123",
      role: "DEVELOPER",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("keyId", "key_123");

    await revokeApiKeyAction(formData);

    expect(redirect).toHaveBeenCalledWith(
      "/settings/api-keys?error=" +
        encodeURIComponent("Only admins and owners can revoke API keys"),
    );
  });

  it("requires keyId", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_123", email: "admin@example.com", name: "Admin User" },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    // No keyId set

    await revokeApiKeyAction(formData);

    expect(redirect).toHaveBeenCalledWith(
      "/settings/api-keys?error=" +
        encodeURIComponent("API key ID is required"),
    );
  });
});

describe("rotateApiKeyAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue({
      id: "user_123",
      email: "admin@example.com",
      name: "Admin User",
    });
  });

  it("rotates API key successfully", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_123", email: "admin@example.com", name: "Admin User" },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.apiKey.findFirst).mockResolvedValue({
      id: "key_old",
      name: "Production Key",
      scopes: ["sites:read", "scan:write"],
      rateLimitPerMinute: 100,
      expiresAt: null,
    } as any);

    vi.mocked(prisma.$transaction).mockImplementation(async (ops: any) => {
      const results = [];
      for (const op of ops) {
        results.push(await op);
      }
      return results;
    });

    vi.mocked(prisma.apiKey.create).mockResolvedValue({
      id: "key_new",
      name: "Production Key",
    } as any);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("keyId", "key_old");

    const result = await rotateApiKeyAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(true);
    expect(result.key).toBeDefined();
    expect(result.key?.plaintext).toMatch(/^arsk_live_[a-f0-9]{64}$/);
    expect(prisma.apiKey.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Production Key",
          scopes: ["sites:read", "scan:write"],
          rateLimitPerMinute: 100,
        }),
      }),
    );
  });

  it("rejects when key not found", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_123", email: "admin@example.com", name: "Admin User" },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.apiKey.findFirst).mockResolvedValue(null);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("keyId", "key_nonexistent");

    const result = await rotateApiKeyAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("API key not found or already revoked");
  });

  it("rejects for DEVELOPER role", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_123", email: "dev@example.com", name: "Dev User" },
      organizationId: "org_123",
      role: "DEVELOPER",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("keyId", "key_123");

    const result = await rotateApiKeyAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Only admins and owners can rotate API keys");
  });
});

describe("getApiKeyUsageStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns usage stats for API keys", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_123", email: "admin@example.com", name: "Admin User" },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.apiKey.findMany).mockResolvedValue([
      {
        id: "key_1",
        name: "Production Key",
        scopes: ["sites:read"],
        rateLimitPerMinute: 100,
        isActive: true,
        lastUsedAt: new Date("2024-01-15"),
        expiresAt: null,
        createdAt: new Date("2024-01-01"),
        mcpUsageLogs: [
          { id: "log_1", createdAt: new Date("2024-01-15") },
          { id: "log_2", createdAt: new Date("2024-01-14") },
        ],
      },
      {
        id: "key_2",
        name: "Dev Key",
        scopes: ["*"],
        rateLimitPerMinute: 60,
        isActive: true,
        lastUsedAt: null,
        expiresAt: new Date("2024-12-31"),
        createdAt: new Date("2024-01-10"),
        mcpUsageLogs: [],
      },
    ] as any);

    const result = await getApiKeyUsageStats("org_123");

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: "key_1",
      name: "Production Key",
      totalCalls: 2,
    });
    expect(result[1]).toMatchObject({
      id: "key_2",
      name: "Dev Key",
      totalCalls: 0,
    });
  });

  it("filters inactive keys", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_123", email: "admin@example.com", name: "Admin User" },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.apiKey.findMany).mockResolvedValue([]);

    await getApiKeyUsageStats("org_123");

    expect(prisma.apiKey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org_123",
          isActive: true,
        }),
      }),
    );
  });

  it("rejects for DEVELOPER role", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_123", email: "dev@example.com", name: "Dev User" },
      organizationId: "org_123",
      role: "DEVELOPER",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    await expect(getApiKeyUsageStats("org_123")).rejects.toThrow(
      "Only admins and owners can view API key usage",
    );
  });
});
