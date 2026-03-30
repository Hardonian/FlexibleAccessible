import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasPermission } from "@aros/config";
import {
  collectPlatformHealth,
  buildRoutePlatformTruth,
} from "@aros/core-services";
import { buildFindingsOperationalSummary } from "@/lib/findings/reporting-summary";

export async function GET(request: Request) {
  try {
    const user = await requireSession();
    const { searchParams } = new URL(request.url);
    const requestedOrgId = searchParams.get("organizationId");
    const membership = await prisma.membership.findFirst({
      where: {
        userId: user.id,
        ...(requestedOrgId ? { organizationId: requestedOrgId } : {}),
      },
      select: { organizationId: true, role: true },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!hasPermission(membership.role, "reports:view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const health = await collectPlatformHealth(prisma);
    const truth = buildRoutePlatformTruth(health);

    if (!truth.allowOrgScopedDbReads) {
      return NextResponse.json(
        {
          error: "degraded",
          message:
            "Operational summary unavailable while database or session store is unhealthy.",
          userImpactSummary: truth.userImpactSummary,
        },
        { status: 503 },
      );
    }

    const summary = await buildFindingsOperationalSummary(
      prisma,
      membership.organizationId,
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
