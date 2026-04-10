import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addVerifiedDomainAction,
  updateIdentityPolicyAction,
} from "./actions";

vi.mock("@/lib/db", () => ({
  prisma: {
    organizationAuthPolicy: { upsert: vi.fn() },
    organizationVerifiedDomain: { upsert: vi.fn(), deleteMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/auth-guard", () => ({
  requireOrgAccess: vi.fn(),
}));

vi.mock("@/lib/route-data-boundary", () => ({
  runOrgScopedQuery: vi.fn(async (ctx: any, query: any) => ({ ok: true, data: await query(ctx.organizationId) })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { prisma } from "@/lib/db";
import { requireOrgAccess } from "@/lib/auth-guard";

describe("identity actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_1" },
      organizationId: "org_1",
      role: "ADMIN",
    } as any);
    vi.mocked(prisma.organizationAuthPolicy.upsert).mockResolvedValue({ id: "policy_1" } as any);
    vi.mocked(prisma.organizationVerifiedDomain.upsert).mockResolvedValue({ id: "dom_1", verifiedAt: new Date() } as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
  });

  it("rejects sso-only with incomplete config", async () => {
    const formData = new FormData();
    formData.set("organizationId", "org_1");
    formData.set("loginMode", "SSO_ONLY");
    formData.set("ssoConfigStatus", "INCOMPLETE");

    const result = await updateIdentityPolicyAction({ success: false, error: null }, formData);
    expect(result.success).toBe(false);
    expect(prisma.organizationAuthPolicy.upsert).not.toHaveBeenCalled();
  });

  it("adds verified domain", async () => {
    const formData = new FormData();
    formData.set("organizationId", "org_1");
    formData.set("domain", "example.com");
    formData.set("markVerified", "on");

    const result = await addVerifiedDomainAction({ success: false, error: null }, formData);
    expect(result.success).toBe(true);
    expect(prisma.organizationVerifiedDomain.upsert).toHaveBeenCalled();
  });
});
