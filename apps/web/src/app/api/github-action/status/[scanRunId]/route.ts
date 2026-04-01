import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { ApiError } from "@aros/shared";

/**
 * GET /api/github-action/status/[scanRunId]
 * Poll scan status for GitHub Action. Returns findings summary when complete.
 * Requires authentication and tenant isolation via session + organization membership.
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
      include: {
        site: {
          include: {
            workspace: {
              include: {
                organization: {
                  include: {
                    memberships: {
                      where: { userId: user.id },
                      take: 1,
                    },
                    subscription: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!scanRun) {
      return apiError(ApiError.notFound("Scan not found"));
    }

    const membership = scanRun.site.workspace.organization.memberships;
    if (membership.length === 0) {
      return apiError(ApiError.forbidden("Access denied to this organization"));
    }

    const { site, ...scanRunData } = scanRun;

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
        ...scanRunData,
        score,
        severityCounts,
      });
    }

    return apiSuccess(scanRunData);
  } catch (error) {
    return apiError(error);
  }
}
