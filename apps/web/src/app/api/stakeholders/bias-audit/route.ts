import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/auth-guard";
import { BiasAuditEngine, BIAS_DIMENSIONS } from "@aros/stakeholders";

const biasAudit = new BiasAuditEngine();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 },
      );
    }

    await requireOrgAccess(organizationId, "stakeholders:audit", {
      requirePaid: true,
    });

    const rawDimension = searchParams.get("dimension");
    const entries = rawDimension && (BIAS_DIMENSIONS as readonly string[]).includes(rawDimension)
      ? await biasAudit.getEntriesByDimension(rawDimension as (typeof BIAS_DIMENSIONS)[number])
      : await biasAudit.getAllEntries();

    return NextResponse.json({ entries });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      error instanceof Error &&
      error.message.includes("do not have access")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[api/stakeholders/bias-audit]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const organizationId = body.organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 },
      );
    }

    await requireOrgAccess(organizationId, "stakeholders:audit", {
      requirePaid: true,
    });

    const result = await biasAudit.runAudit({
      organizationId,
      auditedBy: body.userId,
      stakeholderCount: body.stakeholderCount ?? 0,
      segmentCounts: body.segmentCounts ?? {},
      groupCounts: body.groupCounts ?? {},
      regionCounts: body.regionCounts ?? {},
      languageCounts: body.languageCounts ?? {},
      accessibilityNeedCounts: body.accessibilityNeedCounts ?? {},
      engagementStatusCounts: body.engagementStatusCounts ?? {},
      powerDistribution: body.powerDistribution ?? {},
      interestDistribution: body.interestDistribution ?? {},
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 };
    }
    if (
      error instanceof Error &&
      error.message.includes("do not have access")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 99 });
    }
    console.error("[api/stakeholders/bias-audit POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
