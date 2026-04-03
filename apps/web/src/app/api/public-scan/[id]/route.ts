import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { ApiError } from "@aros/shared";

/**
 * GET /api/public-scan/[id]
 * Poll for public scan result by ID. Used by the results page to show
 * live progress and final results.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    const scan = await prisma.publicScanResult.findUnique({
      where: { id },
      select: {
        id: true,
        domain: true,
        status: true,
        score: true,
        totalViolations: true,
        criticalCount: true,
        seriousCount: true,
        moderateCount: true,
        minorCount: true,
        pagesScanned: true,
        violations: true,
        screenshotKeys: true,
        createdAt: true,
        completedAt: true,
        expiresAt: true,
      },
    });

    if (!scan) {
      return apiError(ApiError.notFound("Scan not found"));
    }
    if (scan.expiresAt && scan.expiresAt <= new Date()) {
      return apiError(
        new ApiError(
          "Scan result has expired. Start a new scan to generate fresh evidence.",
          "SCAN_EXPIRED",
          410,
        ),
      );
    }

    return apiSuccess({
      id: scan.id,
      domain: scan.domain,
      status: scan.status,
      score: scan.score,
      totalViolations: scan.totalViolations,
      criticalCount: scan.criticalCount,
      seriousCount: scan.seriousCount,
      moderateCount: scan.moderateCount,
      minorCount: scan.minorCount,
      pagesScanned: scan.pagesScanned,
      violations: scan.violations,
      screenshotKeys: scan.screenshotKeys,
      createdAt: scan.createdAt,
      completedAt: scan.completedAt,
    });
  } catch (error) {
    return apiError(error);
  }
}
