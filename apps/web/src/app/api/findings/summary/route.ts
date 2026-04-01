import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/auth-guard";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import { buildFindingsOperationalSummary } from "@/lib/findings/reporting-summary";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import { resolveDashboardOrgMembership } from "@/lib/route-data-boundary";
import { getEntitlementState } from "@/lib/auth-guard";

export async function GET(request: Request) {
  try {
    // Use centralized auth guard - it handles org resolution and permission checks
    const ctx = await requireOrgAccess(requestedOrgId || "", "findings:view", {
      requirePaid: true,
    });

    const truth = await getRoutePlatformTruth();
    const summary = await buildFindingsOperationalSummary(
      prisma,
      ctx.organizationId,
      truth.flags.jobPipelinesHealthy,
    );

    return NextResponse.json({
      summary,
      platform: {
        jobPipelinesHealthy: truth.flags.jobPipelinesHealthy,
        workerRunning: truth.flags.workerRunning,
        optionalSubsystemIssues: truth.optionalSubsystemIssues,
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[api/findings/summary]", e);
    return NextResponse.json(
      { error: "Failed to build summary" },
      { status: 500 },
    );
  }
}
