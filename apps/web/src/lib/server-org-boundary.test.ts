import { describe, expect, it, vi, beforeEach } from "vitest";
vi.mock("@/lib/auth-guard", () => ({
  requireOrgAccess: vi.fn(),
}));

vi.mock("@/lib/route-data-boundary", () => ({
  runOrgScopedQuery: vi.fn(),
}));

import { requireOrgAccess } from "@/lib/auth-guard";
import { runOrgScopedQuery } from "@/lib/route-data-boundary";
import { requireCanonicalOrgAccess, runCanonicalOrgQuery } from "./server-org-boundary";

describe("server-org-boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails closed when organizationId is missing", async () => {
    await expect(requireCanonicalOrgAccess(undefined, "finding:view")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      statusCode: 400,
    });
  });

  it("returns canonical context from requireOrgAccess", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValueOnce({
      organizationId: "org-safe",
      role: "ADMIN",
    } as any);

    await expect(requireCanonicalOrgAccess("org-safe", "finding:view")).resolves.toEqual({
      organizationId: "org-safe",
      role: "ADMIN",
    });
  });

  it("denies cross-tenant unsafe query execution when org query wrapper returns not ok", async () => {
    vi.mocked(runOrgScopedQuery).mockResolvedValueOnce({
      ok: false,
      message: "Tenant isolation violation: Missing organization context",
    });

    await expect(
      runCanonicalOrgQuery({ organizationId: "", role: "ADMIN" } as any, async () => "never"),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
      message: "Tenant isolation violation: Missing organization context",
    });
  });

  it("rethrows AppError-shaped failures from org wrapper (correct HTTP semantics)", async () => {
    vi.mocked(runOrgScopedQuery).mockResolvedValueOnce({
      ok: false,
      message: "Finding not found",
      statusCode: 404,
      code: "NOT_FOUND",
    });

    await expect(
      runCanonicalOrgQuery({ organizationId: "org-1", role: "ADMIN" } as any, async () => "never"),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404,
      message: "Finding not found",
    });
  });

  it("returns data when org wrapper succeeds", async () => {
    vi.mocked(runOrgScopedQuery).mockResolvedValueOnce({ ok: true, data: { count: 4 } });

    await expect(
      runCanonicalOrgQuery({ organizationId: "org-safe", role: "ADMIN" } as any, async () => ({ count: 4 })),
    ).resolves.toEqual({ count: 4 });
  });
});
