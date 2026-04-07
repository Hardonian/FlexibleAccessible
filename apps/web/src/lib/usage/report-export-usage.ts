import type { PrismaClient } from "@aros/db";

/** UsageRecord.metric for findings report downloads (JSON or CSV). */
export const USAGE_METRIC_REPORT_EXPORT = "report.export" as const;
/** UsageRecord.metric for VPAT report generation/download. */
export const USAGE_METRIC_VPAT_EXPORT = "report.vpat_export" as const;

/**
 * Records one export event against the org's current Stripe billing period when available.
 * No-ops if subscription periods are missing (e.g. legacy row) so exports never fail on metering.
 */
export async function recordReportExportUsage(
  prisma: PrismaClient,
  organizationId: string,
  metric: string,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) return;

  const sub = await prisma.subscription.findUnique({
    where: { organizationId },
    select: {
      id: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
    },
  });

  if (
    !sub?.currentPeriodStart ||
    !sub.currentPeriodEnd
  ) {
    return;
  }

  await prisma.usageRecord.create({
    data: {
      subscriptionId: sub.id,
      metric,
      quantity,
      periodStart: sub.currentPeriodStart,
      periodEnd: sub.currentPeriodEnd,
    },
  });
}
