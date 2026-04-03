import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveDashboardOrgMembership, runOrgScopedQuery } from "./route-data-boundary";
import { prisma } from "./db";
import { cookies } from "next/headers";

vi.mock("./db", () => ({
  prisma: {
    membership: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

describe("route-data-boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns platform_blocked and never queries membership when platform truth blocks DB reads", async () => {
    const result = await resolveDashboardOrgMembership("user-1", {
      allowOrgScopedDbReads: false,
    } as any);

    expect(result).toEqual({
      kind: "platform_blocked",
      truth: { allowOrgScopedDbReads: false },
    });
    expect(prisma.membership.findUnique).not.toHaveBeenCalled();
    expect(prisma.membership.findFirst).not.toHaveBeenCalled();
  });

  it("prefers cookie-selected org membership when it exists", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "org-cookie" }),
    } as any);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      organizationId: "org-cookie",
      role: "ADMIN",
    } as any);

    const result = await resolveDashboardOrgMembership("user-1", {
      allowOrgScopedDbReads: true,
    } as any);

    expect(result).toEqual({
      kind: "ok",
      organizationId: "org-cookie",
      role: "ADMIN",
    });
    expect(prisma.membership.findFirst).not.toHaveBeenCalled();
  });

  it("falls back to oldest membership when cookie org is absent or invalid", async () => {
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    } as any);
    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      organizationId: "org-fallback",
      role: "DEVELOPER",
    } as any);

    const result = await resolveDashboardOrgMembership("user-1", {
      allowOrgScopedDbReads: true,
    } as any);

    expect(result).toEqual({
      kind: "ok",
      organizationId: "org-fallback",
      role: "DEVELOPER",
    });
    expect(prisma.membership.findFirst).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { organizationId: true, role: true },
      orderBy: { createdAt: "asc" },
    });
  });

  it("blocks query execution when organization context is missing", async () => {
    const query = vi.fn();
    const result = await runOrgScopedQuery({ role: "ADMIN" } as any, query);

    expect(result).toEqual({
      ok: false,
      message: "Tenant isolation violation: Missing organization context",
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("injects canonical organizationId into callback for safe tenant-scoped execution", async () => {
    const query = vi.fn().mockResolvedValue({ id: "result" });
    const result = await runOrgScopedQuery(
      { organizationId: "org-safe", role: "ADMIN" },
      query,
    );

    expect(result).toEqual({ ok: true, data: { id: "result" } });
    expect(query).toHaveBeenCalledWith("org-safe");
  });
});
