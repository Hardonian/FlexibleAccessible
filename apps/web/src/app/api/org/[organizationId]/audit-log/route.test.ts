import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import * as boundary from "@/lib/server-org-boundary";
import { prisma } from "@/lib/db";

vi.mock("@/lib/server-org-boundary", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server-org-boundary")>();
  return {
    ...actual,
    requireCanonicalOrgAccess: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    auditLog: {
      findMany: vi.fn(),
    },
  },
}));

describe("GET /api/org/[organizationId]/audit-log", () => {
  beforeEach(() => {
    vi.mocked(boundary.requireCanonicalOrgAccess).mockResolvedValue({
      organizationId: "org_1",
      role: "AUDITOR",
    });
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
      {
        id: "a1",
        action: "login",
        entityType: null,
        entityId: null,
        userId: "u1",
        metadata: null,
        ipAddress: "1.2.3.4",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ] as Awaited<ReturnType<typeof prisma.auditLog.findMany>>);
  });

  it("returns JSON for auditors with paid org", async () => {
    const req = new Request("http://localhost/api/org/org_1/audit-log?limit=10");
    const res = await GET(req, {
      params: Promise.resolve({ organizationId: "org_1" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.count).toBe(1);
    expect(json.entries[0].action).toBe("login");
  });

  it("returns CSV when format=csv", async () => {
    const req = new Request("http://localhost/api/org/org_1/audit-log?format=csv");
    const res = await GET(req, {
      params: Promise.resolve({ organizationId: "org_1" }),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("id,createdAt,action");
    expect(text).toContain("login");
  });
});
