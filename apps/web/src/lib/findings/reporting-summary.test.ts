import { describe, expect, it, vi } from "vitest";
import { buildFindingsOperationalSummary } from "./reporting-summary";

describe("buildFindingsOperationalSummary", () => {
  it("includes recurrence hotspots and review queue metrics", async () => {
    const countMock = vi
      .fn()
      // totals + severity + evidence mix (17)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      // recurrence + queue + stale automated
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    const groupByMock = vi
      .fn()
      .mockResolvedValueOnce([
        { ruleId: "color-contrast", _count: { _all: 4 } },
        { ruleId: "image-alt", _count: { _all: 2 } },
      ])
      .mockResolvedValueOnce([{ ruleId: "color-contrast", _count: { _all: 2 } }]);

    const prisma = {
      canonicalFinding: {
        count: countMock,
        groupBy: groupByMock,
      },
      scanRun: {
        findFirst: vi.fn().mockResolvedValue({
          completedAt: new Date("2026-04-01T00:00:00.000Z"),
        }),
      },
      reviewTask: {
        count: countMock,
      },
    };

    const result = await buildFindingsOperationalSummary(
      prisma as never,
      "org_123",
      true,
    );

    expect(result.recurrence.recurringAcrossScanRuns).toBe(6);
    expect(result.recurrence.topRecurringRuleHotspots).toEqual([
      {
        ruleId: "color-contrast",
        recurringFindings: 4,
        criticalOpenFindings: 2,
      },
      {
        ruleId: "image-alt",
        recurringFindings: 2,
        criticalOpenFindings: 0,
      },
    ]);
    expect(result.reviewQueue).toEqual({
      unresolved: 3,
      overdue72h: 1,
      manualAuditPending: 1,
    });
    expect(result.staleAutomationCount).toBe(2);
  });
});
