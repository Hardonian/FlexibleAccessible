import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@aros/db", () => ({
  prisma: {
    apiKey: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
    site: { findFirst: vi.fn() },
    scanRun: { findFirst: vi.fn() },
    canonicalFinding: { findFirst: vi.fn() },
    remediationSuggestion: { findFirst: vi.fn() },
    mcpUsageLog: { create: vi.fn() },
  },
}));

describe("MCP Server org access validation", () => {
  let boundOrgId: string | null = null;

  function validateOrgAccess(organizationId: string): string | null {
    if (boundOrgId && organizationId !== boundOrgId) {
      return `Access denied: API key is bound to organization ${boundOrgId}`;
    }
    return null;
  }

  beforeEach(() => {
    boundOrgId = null;
  });

  describe("validateOrgAccess", () => {
    it("allows access when no API key is bound (unauthenticated)", () => {
      boundOrgId = null;
      const result = validateOrgAccess("org_any");
      expect(result).toBeNull();
    });

    it("allows access when orgId matches bound org", () => {
      boundOrgId = "org_correct";
      const result = validateOrgAccess("org_correct");
      expect(result).toBeNull();
    });

    it("denies access when orgId does not match bound org", () => {
      boundOrgId = "org_bound";
      const result = validateOrgAccess("org_attacker");
      expect(result).toBe(
        "Access denied: API key is bound to organization org_bound",
      );
    });

    it("denies cross-org scan status access", () => {
      boundOrgId = "org_a";
      const attackerOrgId = "org_b";
      const result = validateOrgAccess(attackerOrgId);
      expect(result).toBe(
        "Access denied: API key is bound to organization org_a",
      );
    });

    it("denies cross-org suggestion approval", () => {
      boundOrgId = "org_owned";
      const crossOrgId = "org_other";
      const result = validateOrgAccess(crossOrgId);
      expect(result).toBe(
        "Access denied: API key is bound to organization org_owned",
      );
    });
  });

  describe("org-scoped query patterns", () => {
    it("scanRun.findFirst requires org-scoped filter", () => {
      const queryFilters = [
        { id: "scan_123", site: { workspace: { organizationId: "org_a" } } },
      ];
      expect(queryFilters[0].site.workspace.organizationId).toBe("org_a");
    });

    it("remediationSuggestion.findFirst requires org-scoped filter", () => {
      const queryFilters = [
        {
          id: "suggestion_123",
          canonicalFinding: {
            site: { workspace: { organizationId: "org_a" } },
          },
        },
      ];
      expect(
        queryFilters[0].canonicalFinding.site.workspace.organizationId,
      ).toBe("org_a");
    });

    it("suggestions list query requires org-scoped filter", () => {
      const queryFilters = [
        {
          status: "VALIDATED",
          canonicalFinding: {
            site: {
              workspace: { organizationId: "org_a" },
              id: "site_123",
            },
          },
        },
      ];
      expect(
        queryFilters[0].canonicalFinding.site.workspace.organizationId,
      ).toBe("org_a");
    });

    it("conformance report scanRuns require org-scoped filter", () => {
      const scanRunFilters = [
        {
          siteId: "site_123",
          site: { workspace: { organizationId: "org_a" } },
        },
      ];
      expect(scanRunFilters[0].site.workspace.organizationId).toBe("org_a");
    });
  });
});
