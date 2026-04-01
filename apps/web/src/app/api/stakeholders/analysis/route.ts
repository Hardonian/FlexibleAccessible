// ─── Comprehensive Analysis API ────────────────────────────────────────
// GET: Build comprehensive stakeholder analysis - requires org access + paid

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { requireOrgAccess } from "@/lib/auth-guard";
import {
  buildStakeholderAnalysis,
  generateGapAnalysis,
} from "@aros/stakeholders";

export async function GET(request: Request) {
  try {
    const user = await requireSession();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 },
      );
    }

    await requireOrgAccess(organizationId, "stakeholders:view", {
      requirePaid: true,
    });

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
