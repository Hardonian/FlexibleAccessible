import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  recordReportExportUsage,
  USAGE_METRIC_REPORT_EXPORT,
} from "./report-export-usage";
import type { PrismaClient } from "@aros/db";

describe("recordReportExportUsage", () => {
  const create = vi.fn();
  const findUnique = vi.fn();

  const prisma = {
    subscription: { findUnique },
    usageRecord: { create },
  } as unknown as PrismaClient;

  beforeEach(() => {
    create.mockReset();
    findUnique.mockReset();
  });

  it("no-ops when subscription periods are missing", async () => {
    findUnique.mockResolvedValue({
      id: "sub_1",
      currentPeriodStart: null,
      currentPeriodEnd: new Date(),
    });
    await recordReportExportUsage(prisma, "org_1", USAGE_METRIC_REPORT_EXPORT, 1);
    expect(create).not.toHaveBeenCalled();
  });

  it("creates UsageRecord when period bounds exist", async () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const end = new Date("2026-02-01T00:00:00.000Z");
    findUnique.mockResolvedValue({
      id: "sub_1",
      currentPeriodStart: start,
      currentPeriodEnd: end,
    });
    await recordReportExportUsage(prisma, "org_1", USAGE_METRIC_REPORT_EXPORT, 2);
    expect(create).toHaveBeenCalledWith({
      data: {
        subscriptionId: "sub_1",
        metric: USAGE_METRIC_REPORT_EXPORT,
        quantity: 2,
        periodStart: start,
        periodEnd: end,
      },
    });
  });
});
