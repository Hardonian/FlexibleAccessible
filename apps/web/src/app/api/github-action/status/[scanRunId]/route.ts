import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { ApiError } from "@aros/shared";
import { requireCanonicalOrgAccess } from "@/lib/server-org-boundary";
import {
  findGithubActionScanRun,
  getScanRunSeverityCounts,
} from "@/lib/integrations/org-scoped-queries";

/**
 * GET /api/github-action/status/[scanRunId]?organizationId=...
 * Poll scan status for GitHub Action. Returns findings summary when complete.
 * Requires authentication and canonical organization membership context.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ scanRunId: string }> },
) {
  try {
    await requireSession();
    const { scanRunId } = await context.params;
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    const ctx = await requireCanonicalOrgAccess(organizationId, "scan:view", {
      requirePaid: true,
    });

    const scanRun = await findGithubActionScanRun(ctx, scanRunId);

    if (!scanRun) {
      return apiError(ApiError.notFound("Scan not found"));
    }

    if (scanRun.status === "COMPLETED") {
      const findings = await getScanRunSeverityCounts(ctx, scanRunId);

      const severityCounts: Record<string, number> = {};
      for (const finding of findings) {
        severityCounts[finding.impact] = finding._count._all;
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
