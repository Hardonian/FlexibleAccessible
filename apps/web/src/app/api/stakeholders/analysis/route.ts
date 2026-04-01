import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/auth-guard";
import {
  buildStakeholderAnalysis,
  generateGapAnalysis,
} from "@aros/stakeholders";

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

    const ctx = await requireOrgAccess(organizationId, "stakeholders:view", {
      requirePaid: true,
    });

    const includeGapAnalysis = searchParams.get("includeGaps") === "true";

    const analysis = await buildStakeholderAnalysis(organizationId, {
      auditedBy: ctx.user.id,
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
    if (
      error instanceof Error &&
      error.message.includes("do not have access")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[api/stakeholders/analysis]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
