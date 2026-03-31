// ─── Bias Audit API ────────────────────────────────────────────────────
// POST: Run bias audit with stakeholder context
// GET: Get bias audit entries

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasPermission } from "@aros/config";
import { BiasAuditEngine } from "@aros/stakeholders";

const biasAudit = new BiasAuditEngine();

export async function GET(request: Request) {
  try {
    const user = await requireSession();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (organizationId) {
      const membership = await prisma.membership.findFirst({
        where: { userId: user.id, organizationId },
      });
      if (
        !membership ||
        !hasPermission(membership.role, "stakeholders:audit")
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const dimension = searchParams.get("dimension") as any;
    const entries = dimension
      ? await biasAudit.getEntriesByDimension(dimension)
      : await biasAudit.getAllEntries();

    return NextResponse.json({ entries });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const user = await requireSession();
    const body = await request.json();

    const organizationId = body.organizationId;
    if (organizationId) {
      const membership = await prisma.membership.findFirst({
        where: { userId: user.id, organizationId },
      });
      if (
        !membership ||
        !hasPermission(membership.role, "stakeholders:audit")
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const result = await biasAudit.runAudit({
      organizationId: body.organizationId || "default",
      auditedBy: user.id,
      stakeholderCount: body.stakeholderCount || 0,
      segmentCounts: body.segmentCounts || {},
      groupCounts: body.groupCounts || {},
      regionCounts: body.regionCounts || {},
      languageCounts: body.languageCounts || {},
      accessibilityNeedCounts: body.accessibilityNeedCounts || {},
      engagementStatusCounts: body.engagementStatusCounts || {},
      powerDistribution: body.powerDistribution || {},
      interestDistribution: body.interestDistribution || {},
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[api/stakeholders/bias-audit POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
