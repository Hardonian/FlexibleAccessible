import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { ApiError } from "@aros/shared";

vi.mock("@/lib/server-org-boundary", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server-org-boundary")>();
  return {
    ...actual,
    requireCanonicalOrgAccess: vi.fn(),
  };
});

vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    canonicalFinding: {
      findFirst: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
    aiUsageLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@aros/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@aros/shared")>();
  return {
    ...actual,
    generateToken: vi.fn(() => "mock-token"),
  };
});

vi.mock("fetch", () => ({
  default: vi.fn(),
}));

import { requireCanonicalOrgAccess } from "@/lib/server-org-boundary";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";

describe("AI Copilot API", () => {
  beforeEach(() => {
    vi.mocked(requireSession).mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      name: "Test User",
      emailVerified: true,
    });
  });

  it("should reject unauthorized users", async () => {
    const mockRequire = vi.mocked(requireCanonicalOrgAccess);
    mockRequire.mockRejectedValueOnce(
      ApiError.forbidden("Missing permission: finding:manage"),
    );

    const request = new Request("http://localhost/api/ai-copilot", {
      method: "POST",
      body: JSON.stringify({
        findingId: "finding-1",
        organizationId: "org-1",
        message: "Test message",
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.success).toBe(false);
  });

  it("should reject when finding not found or not in org", async () => {
    const mockRequire = vi.mocked(requireCanonicalOrgAccess);
    mockRequire.mockResolvedValueOnce({
      organizationId: "org-1",
      role: "OWNER",
    });

    const mockFindFirst = vi.mocked(prisma.canonicalFinding.findFirst);
    mockFindFirst.mockResolvedValueOnce(null);

    const request = new Request("http://localhost/api/ai-copilot", {
      method: "POST",
      body: JSON.stringify({
        findingId: "finding-1",
        organizationId: "org-1",
        message: "Test message",
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.success).toBe(false);
  });

  it("should reject when AI not enabled", async () => {
    const mockRequire = vi.mocked(requireCanonicalOrgAccess);
    mockRequire.mockResolvedValueOnce({
      organizationId: "org-1",
      role: "OWNER",
    });

    const mockFindFirst = vi.mocked(prisma.canonicalFinding.findFirst);
    mockFindFirst.mockResolvedValueOnce({
      id: "finding-1",
      ruleId: "test-rule",
      impact: "MODERATE",
      description: "Test finding",
      wcagCriteria: [],
      occurrences: [],
      suggestions: [],
    } as any);
    vi.mocked(prisma.subscription.findUnique).mockResolvedValueOnce({
      aiEnabled: false,
    } as any);

    const request = new Request("http://localhost/api/ai-copilot", {
      method: "POST",
      body: JSON.stringify({
        findingId: "finding-1",
        organizationId: "org-1",
        message: "Test message",
      }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error.code).toBe("AI_NOT_ENABLED");
  });
});
