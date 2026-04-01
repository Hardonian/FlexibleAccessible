import { describe, it, expect, vi, beforeEach } from "vitest";
import { startCrawlAction } from "./actions";
import { ApiError } from "@aros/shared";

vi.mock("@/lib/auth-guard", () => ({
  requireSiteAccess: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    crawlRun: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    site: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/queue", () => ({
  getCrawlQueue: vi.fn(() => ({
    add: vi.fn(),
  })),
  type: {
    CrawlJobData: {},
  },
}));

import { requireSiteAccess } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { getCrawlQueue } from "@/lib/queue";

const mockRequireSiteAccess = vi.mocked(requireSiteAccess);
const mockPrisma = vi.mocked(prisma);
const mockGetCrawlQueue = vi.mocked(getCrawlQueue);

describe("Server Actions Auth Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("startCrawlAction", () => {
    it("should require authenticated user and site access", async () => {
      mockRequireSiteAccess.mockRejectedValue(
        new ApiError("Unauthorized", "UNAUTHORIZED", 401),
      );

      const formData = new FormData();
      formData.set("siteId", "test-site");

      await expect(startCrawlAction(formData)).rejects.toThrow("Unauthorized");
      expect(mockRequireSiteAccess).toHaveBeenCalledWith(
        "test-site",
        "scan:start",
        {
          requirePaid: true,
        },
      );
    });

    it("should require premium subscription", async () => {
      mockRequireSiteAccess.mockRejectedValue(
        new ApiError(
          "Premium subscription required",
          "SUBSCRIPTION_REQUIRED",
          403,
        ),
      );

      const formData = new FormData();
      formData.set("siteId", "test-site");

      await expect(startCrawlAction(formData)).rejects.toThrow(
        "Premium subscription required",
      );
    });

    it("should prevent access to sites in other organizations", async () => {
      mockRequireSiteAccess.mockRejectedValue(
        new ApiError("Site not found", "NOT_FOUND", 404),
      );

      const formData = new FormData();
      formData.set("siteId", "other-org-site");

      await expect(startCrawlAction(formData)).rejects.toThrow(
        "Site not found",
      );
    });

    it("should successfully start crawl when authorized", async () => {
      const mockCtx = {
        user: { id: "user-1", email: "test@example.com", name: "Test User" },
        organizationId: "org-1",
        role: "DEVELOPER" as const,
        subscription: null,
        entitlement: { hasPaidAccess: true, reason: "active_paid" as const },
        siteId: "site-1",
        workspaceId: "workspace-1",
      };

      mockRequireSiteAccess.mockResolvedValue(mockCtx);
      (mockPrisma.crawlRun.findFirst as any).mockResolvedValue(null); // No running crawl
      (mockPrisma.site.findUnique as any).mockResolvedValue({
        id: "site-1",
        crawlConfig: {
          sitemapUrl: null,
          maxDepth: 5,
          maxPages: 100,
          includePatterns: [],
          excludePatterns: [],
          respectRobots: true,
          renderJavaScript: true,
          viewports: [{ width: 1280, height: 720 }],
        },
      });
      (mockPrisma.crawlRun.create as any).mockResolvedValue({ id: "crawl-1" });
      mockGetCrawlQueue.mockReturnValue({
        add: vi.fn().mockResolvedValue(undefined),
      } as any);

      const formData = new FormData();
      formData.set("siteId", "site-1");

      // Should not throw - redirects on success
      await expect(startCrawlAction(formData)).rejects.toThrow(); // redirect throws
      expect(mockRequireSiteAccess).toHaveBeenCalledWith(
        "site-1",
        "scan:start",
        {
          requirePaid: true,
        },
      );
    });
  });
});
