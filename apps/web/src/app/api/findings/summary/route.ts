import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/auth-guard";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import { buildFindingsOperationalSummary } from "@/lib/findings/reporting-summary";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedOrgId = searchParams.get("organizationId");

    if (!requestedOrgId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 },
      );
    }

    // Use centralized auth guard - it handles org resolution and permission checks
    const ctx = await requireOrgAccess(requestedOrgId, "finding:view", {
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
    if (e instanceof Error && e.message.includes("do not have access")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[api/findings/summary]", e);
    return NextResponse.json(
      { error: "Failed to build summary" },
      { status: 500 },
    );
  }
}
