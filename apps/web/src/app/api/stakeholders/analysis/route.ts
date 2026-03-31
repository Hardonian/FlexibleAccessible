// ─── Comprehensive Analysis API ────────────────────────────────────────
// GET: Build comprehensive stakeholder analysis

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasPermission } from "@aros/config";
import {
  buildStakeholderAnalysis,
  generateGapAnalysis,
} from "@aros/stakeholders";

export async function GET(request: Request) {
  try {
    const user = await requireSession();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId") || "default";

    if (searchParams.get("organizationId")) {
      const membership = await prisma.membership.findFirst({
        where: { userId: user.id, organizationId },
      });
      if (!membership || !hasPermission(membership.role, "stakeholders:view")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const includeGapAnalysis = searchParams.get("includeGaps") === "true";

    const analysis = await buildStakeholderAnalysis(organizationId, {
      auditedBy: user.id,
      hasRegistry: true,
      hasEngagementStrategy: true,
      hasCommunicationPlan: true,
      hasFeedbackLoop: true,
      hasBiasAudit: true,
      hasValidationFramework: true,
      hasGoalAlignment: true,
    });

    let gapAnalysis = null;
    if (includeGapAnalysis) {
      gapAnalysis = await generateGapAnalysis(organizationId);
    }

    return NextResponse.json({
      analysis,
      gapAnalysis,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[api/stakeholders/analysis]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
