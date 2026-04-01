import { describe, it, expect, vi } from "vitest";
import { POST } from "./route";
import { ApiError } from "@aros/shared";

vi.mock("@/lib/auth-guard", () => ({
  requireOrgAccess: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    canonicalFinding: {
      findFirst: vi.fn(),
    },
    aiUsageLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@aros/shared", () => ({
  generateToken: vi.fn(() => "mock-token"),
}));

vi.mock("fetch", () => ({
  default: vi.fn(),
}));

import { requireOrgAccess } from "@/lib/auth-guard";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";

describe("AI Copilot API", () => {
  it("should reject unauthorized users", async () => {
    const mockRequireOrgAccess = vi.mocked(requireOrgAccess);
    mockRequireOrgAccess.mockRejectedValueOnce(
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
    const mockRequireOrgAccess = vi.mocked(requireOrgAccess);
    mockRequireOrgAccess.mockResolvedValueOnce({
      user: { id: "user-1" },
      organizationId: "org-1",
      role: "OWNER",
      subscription: null,
      entitlement: { hasPaidAccess: true, reason: "active_paid" },
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
    const mockRequireOrgAccess = vi.mocked(requireOrgAccess);
    mockRequireOrgAccess.mockResolvedValueOnce({
      user: { id: "user-1" },
      organizationId: "org-1",
      role: "OWNER",
      subscription: { aiEnabled: false },
      entitlement: { hasPaidAccess: true, reason: "active_paid" },
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
    });

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
