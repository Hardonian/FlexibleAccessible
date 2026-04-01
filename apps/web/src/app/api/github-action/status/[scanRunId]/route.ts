import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { getEntitlementState } from "@/lib/auth-guard";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { ApiError } from "@aros/shared";

/**
 * GET /api/github-action/status/[scanRunId]
 * Poll scan status for GitHub Action. Returns findings summary when complete.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ scanRunId: string }> },
) {
  try {
    const user = await requireSession();
    const { scanRunId } = await context.params;

    const scanRun = await prisma.scanRun.findUnique({
      where: { id: scanRunId },
      select: {
        id: true,
        status: true,
        totalPages: true,
        pagesScanned: true,
        violationsFound: true,
        errorMessage: true,
        startedAt: true,
        completedAt: true,
        siteId: true,
        site: {
          select: {
            workspace: {
              select: {
                organizationId: true,
                organization: {
                  select: {
                    subscription: {
                      select: {
                        plan: true,
                        status: true,
                        maxDomains: true,
                        maxPagesPerCrawl: true,
                        maxScansPerMonth: true,
                        maxSeats: true,
                        aiEnabled: true,
                        aiTokenLimit: true,
                        currentPeriodEnd: true,
                        cancelAtPeriodEnd: true,
                      },
                    },
                    memberships: {
                      where: { userId: user.id },
                      take: 1,
                      select: { id: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (
      !scanRun ||
      scanRun.site.workspace.organization.memberships.length === 0
    ) {
      return apiError(ApiError.notFound("Scan not found"));
    }

    if (
      !getEntitlementState(
        scanRun.site.workspace.organization.subscription,
      ).hasPaidAccess
    ) {
      return NextResponse.json(
        { success: false, error: { code: "SUBSCRIPTION_REQUIRED", message: "Premium subscription required" } },
        { status: 403 },
      );
    }

    // If completed, aggregate findings by severity
    if (scanRun.status === "COMPLETED") {
      const findings = await prisma.rawViolation.groupBy({
        by: ["impact"],
        where: { scanRunId },
        _count: { _all: true },
      });

      const severityCounts: Record<string, number> = {};
      for (const f of findings) {
        severityCounts[f.impact] = f._count._all;
      }

      // Compute score
      const critical = severityCounts.CRITICAL ?? 0;
      const serious = severityCounts.SERIOUS ?? 0;
      const moderate = severityCounts.MODERATE ?? 0;
      const minor = severityCounts.MINOR ?? 0;
      const penalty = critical * 10 + serious * 5 + moderate * 2 + minor * 0.5;
      const score = Math.max(
        0,
        Math.round(100 - (penalty / Math.max(scanRun.pagesScanned, 1)) * 2),
      );

      return apiSuccess({
        ...scanRun,
        score,
        severityCounts,
      });
    }

    return apiSuccess(scanRun);
  } catch (error) {
    return apiError(error);
  }
}
