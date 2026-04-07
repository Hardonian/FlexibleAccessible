import { describe, expect, it, vi, beforeEach } from "vitest";

const findFirstRemediation = vi.fn();
const updateManyRemediation = vi.fn();
const findFirstReviewTask = vi.fn();
const updateManyReviewTask = vi.fn();
const findFirstApiKey = vi.fn();
const updateManyCrawlConfig = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    remediationSuggestion: {
      findFirst: (...args: unknown[]) => findFirstRemediation(...args),
      updateMany: (...args: unknown[]) => updateManyRemediation(...args),
    },
    remediationRecipe: { update: vi.fn() },
    reviewTask: {
      findFirst: (...args: unknown[]) => findFirstReviewTask(...args),
      updateMany: (...args: unknown[]) => updateManyReviewTask(...args),
    },
    apiKey: {
      findFirst: (...args: unknown[]) => findFirstApiKey(...args),
      update: vi.fn(),
    },
    crawlConfig: {
      updateMany: (...args: unknown[]) => updateManyCrawlConfig(...args),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
  },
}));

vi.mock("@aros/core-services", () => ({
  enqueueSiteScan: vi.fn(),
  persistPostCrawlScanKickoffAfterEnqueue: vi.fn(),
}));

import {
  loadRemediationSuggestionForOrg,
  loadReviewTaskForOrg,
  revokeApiKeyForOrg,
  updateCrawlConfigAutoScan,
  updateReviewTaskStatusForOrg,
} from "./dashboard-org-scoped-prisma";

describe("dashboard-org-scoped-prisma", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes remediation suggestion load by organizationId in the where clause", async () => {
    findFirstRemediation.mockResolvedValueOnce(null);
    await loadRemediationSuggestionForOrg("sug-1", "org-a");
    expect(findFirstRemediation).toHaveBeenCalledTimes(1);
    const arg = findFirstRemediation.mock.calls[0][0];
    expect(arg.where.id).toBe("sug-1");
    expect(arg.where.OR).toBeDefined();
    expect(JSON.stringify(arg.where)).toContain("org-a");
  });

  it("scopes review task load by organizationId in the where clause", async () => {
    findFirstReviewTask.mockResolvedValueOnce(null);
    await loadReviewTaskForOrg("task-1", "org-b");
    expect(findFirstReviewTask).toHaveBeenCalledTimes(1);
    const arg = findFirstReviewTask.mock.calls[0][0];
    expect(arg.where.id).toBe("task-1");
    expect(arg.where.suggestion).toBeDefined();
    expect(JSON.stringify(arg.where)).toContain("org-b");
  });

  it("updateReviewTaskStatusForOrg returns false when no row matches org scope", async () => {
    updateManyReviewTask.mockResolvedValueOnce({ count: 0 });
    const ok = await updateReviewTaskStatusForOrg("task-1", "org-c", {
      status: "APPROVED",
    });
    expect(ok).toBe(false);
    expect(updateManyReviewTask).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "task-1",
          suggestion: expect.anything(),
        }),
      }),
    );
  });

  it("revokeApiKeyForOrg only revokes when key belongs to org", async () => {
    findFirstApiKey.mockResolvedValueOnce(null);
    const r = await revokeApiKeyForOrg("org-x", "key-1");
    expect(r.ok).toBe(false);
    expect(findFirstApiKey).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "key-1",
          organizationId: "org-x",
          isActive: true,
        }),
      }),
    );
  });

  it("updateCrawlConfigAutoScan requires matching site workspace org", async () => {
    updateManyCrawlConfig.mockResolvedValueOnce({ count: 0 });
    const ok = await updateCrawlConfigAutoScan("site-1", "org-y", true);
    expect(ok).toBe(false);
    expect(updateManyCrawlConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          siteId: "site-1",
          site: { workspace: { organizationId: "org-y" } },
        }),
      }),
    );
  });
});
