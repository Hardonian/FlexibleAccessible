import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasPermission } from "@aros/config";
import type { MemberRole } from "@aros/db";
import { buildFindingsOperationalSummary } from "@/lib/findings/reporting-summary";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import { resolveDashboardOrgMembership } from "@/lib/route-data-boundary";

export async function GET(request: Request) {
  try {
    const user = await requireSession();
    const { searchParams } = new URL(request.url);
    const requestedOrgId = searchParams.get("organizationId");
    const truth = await getRoutePlatformTruth();

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

    let resolvedMembership: { organizationId: string; role: MemberRole } | null =
      null;

    if (requestedOrgId) {
      resolvedMembership = await prisma.membership.findUnique({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId: requestedOrgId,
            },
          },
          select: { organizationId: true, role: true },
        });
    } else {
      const membership = await resolveDashboardOrgMembership(user.id, truth);

      if (membership.kind === "error") {
        return NextResponse.json(
          { error: "Membership lookup failed", message: membership.message },
          { status: 500 },
        );
      }

      if (membership.kind === "none" || membership.kind === "platform_blocked") {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      resolvedMembership = {
        organizationId: membership.organizationId,
        role: membership.role,
      };
    }

    if (!resolvedMembership) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!hasPermission(resolvedMembership.role, "reports:view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const summary = await buildFindingsOperationalSummary(
      prisma,
      resolvedMembership.organizationId,
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
