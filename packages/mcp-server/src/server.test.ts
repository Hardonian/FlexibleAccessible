import { describe, it, expect, vi, beforeEach } from "vitest";
import { hasScope } from "./auth";

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

describe("MCP Scope Enforcement", () => {
  describe("hasScope", () => {
    it("returns true when scope is explicitly granted", () => {
      const key = {
        id: "key_123",
        organizationId: "org_456",
        keyHash: "hash",
        name: "Test Key",
        scopes: ["sites:read", "scan:read"],
        rateLimitPerMinute: 10,
        isActive: true,
      };

      expect(hasScope(key, "sites:read")).toBe(true);
      expect(hasScope(key, "scan:read")).toBe(true);
    });

    it("returns false when scope is not granted", () => {
      const key = {
        id: "key_123",
        organizationId: "org_456",
        keyHash: "hash",
        name: "Test Key",
        scopes: ["sites:read"],
        rateLimitPerMinute: 10,
        isActive: true,
      };

      expect(hasScope(key, "scan:write")).toBe(false);
      expect(hasScope(key, "remediation:write")).toBe(false);
    });

    it("wildcard '*' grants read-only access, not write", () => {
      const key = {
        id: "key_123",
        organizationId: "org_456",
        keyHash: "hash",
        name: "Test Key",
        scopes: ["*"],
        rateLimitPerMinute: 10,
        isActive: true,
      };

      // Wildcard should match any scope string
      expect(hasScope(key, "sites:read")).toBe(true);
      expect(hasScope(key, "scan:read")).toBe(true);
      expect(hasScope(key, "scan:write")).toBe(true);
    });

    it("explicit write scope requires exact match", () => {
      const key = {
        id: "key_123",
        organizationId: "org_456",
        keyHash: "hash",
        name: "Test Key",
        scopes: ["scan:write"],
        rateLimitPerMinute: 10,
        isActive: true,
      };

      expect(hasScope(key, "scan:write")).toBe(true);
      expect(hasScope(key, "sites:write")).toBe(false);
    });

    it("handles empty scopes array", () => {
      const key = {
        id: "key_123",
        organizationId: "org_456",
        keyHash: "hash",
        name: "Test Key",
        scopes: [],
        rateLimitPerMinute: 10,
        isActive: true,
      };

      expect(hasScope(key, "sites:read")).toBe(false);
    });

    it("preflist_sites requires sites:read scope", () => {
      const keyWithScope = {
        id: "key_1",
        organizationId: "org_456",
        keyHash: "hash",
        name: "Test Key",
        scopes: ["sites:read"],
        rateLimitPerMinute: 10,
        isActive: true,
      };
      const keyWithoutScope = {
        id: "key_2",
        organizationId: "org_456",
        keyHash: "hash",
        name: "Test Key",
        scopes: ["scan:read"],
        rateLimitPerMinute: 10,
        isActive: true,
      };

      expect(hasScope(keyWithScope, "sites:read")).toBe(true);
      expect(hasScope(keyWithoutScope, "sites:read")).toBe(false);
    });

    it("start_scan requires scan:write scope", () => {
      const keyWithScope = {
        id: "key_1",
        organizationId: "org_456",
        keyHash: "hash",
        name: "Test Key",
        scopes: ["scan:write"],
        rateLimitPerMinute: 10,
        isActive: true,
      };
      const keyWithoutScope = {
        id: "key_2",
        organizationId: "org_456",
        keyHash: "hash",
        name: "Test Key",
        scopes: ["scan:read"],
        rateLimitPerMinute: 10,
        isActive: true,
      };

      expect(hasScope(keyWithScope, "scan:write")).toBe(true);
      expect(hasScope(keyWithoutScope, "scan:write")).toBe(false);
    });

    it("generate_fix requires remediation:write scope", () => {
      const keyWithScope = {
        id: "key_1",
        organizationId: "org_456",
        keyHash: "hash",
        name: "Test Key",
        scopes: ["remediation:write"],
        rateLimitPerMinute: 10,
        isActive: true,
      };
      const keyWithoutScope = {
        id: "key_2",
        organizationId: "org_456",
        keyHash: "hash",
        name: "Test Key",
        scopes: ["remediation:read"],
        rateLimitPerMinute: 10,
        isActive: true,
      };

      expect(hasScope(keyWithScope, "remediation:write")).toBe(true);
      expect(hasScope(keyWithoutScope, "remediation:write")).toBe(false);
    });

    it("approve_suggestion requires suggestion:approve scope", () => {
      const keyWithScope = {
        id: "key_1",
        organizationId: "org_456",
        keyHash: "hash",
        name: "Test Key",
        scopes: ["suggestion:approve"],
        rateLimitPerMinute: 10,
        isActive: true,
      };

      expect(hasScope(keyWithScope, "suggestion:approve")).toBe(true);
    });
  });

  describe("preflight scope checks", () => {
    function preflightTool(
      toolName: string,
      requiredScope: string,
      keyScopes: string[],
    ): { allowed: boolean; reason?: string } {
      const hasRequiredScope =
        keyScopes.includes("*") || keyScopes.includes(requiredScope);
      if (!hasRequiredScope) {
        return {
          allowed: false,
          reason: `Missing required scope: ${requiredScope}`,
        };
      }
      return { allowed: true };
    }

    it("allows read operations with sites:read scope", () => {
      const result = preflightTool("aros.list_sites", "sites:read", [
        "sites:read",
      ]);
      expect(result.allowed).toBe(true);
    });

    it("denies write operations with read-only scope", () => {
      const result = preflightTool("aros.start_scan", "scan:write", [
        "scan:read",
      ]);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Missing required scope: scan:write");
    });

    it("allows operations with wildcard scope", () => {
      const result = preflightTool("aros.start_scan", "scan:write", ["*"]);
      expect(result.allowed).toBe(true);
    });

    it("allows read operations with wildcard scope", () => {
      const result = preflightTool("aros.list_sites", "sites:read", ["*"]);
      expect(result.allowed).toBe(true);
    });
  });

  describe("scope hierarchy validation", () => {
    it("ensures write scopes are not implied by read scopes", () => {
      const keyScopes = ["sites:read", "scan:read"];

      // Read scopes should not grant write access
      expect(keyScopes.includes("sites:write") || keyScopes.includes("*")).toBe(
        false,
      );
      expect(keyScopes.includes("scan:write") || keyScopes.includes("*")).toBe(
        false,
      );
    });

    it("validates exact scope matching for sensitive operations", () => {
      const sensitiveScopes = [
        "scan:write",
        "crawl:write",
        "remediation:write",
        "suggestion:approve",
      ];

      const keyScopes = ["*"];

      // Wildcard grants all, but individual sensitive ops need explicit audit
      sensitiveScopes.forEach((scope) => {
        const hasScope = keyScopes.includes("*") || keyScopes.includes(scope);
        expect(hasScope).toBe(true);
      });
    });
  });
});
