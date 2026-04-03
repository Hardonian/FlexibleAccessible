import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasPermission } from "@aros/config";
import { getEntitlementState, requireOrgAccess } from "@/lib/auth-guard";
import {
  collectPlatformHealth,
  buildRoutePlatformTruth,
} from "@aros/core-services";
import { buildFindingProofSummary } from "@/lib/findings/proof-summary";

export async function GET(request: Request) {
  try {
    const user = await requireSession();
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get("siteId");
    const format = searchParams.get("format") ?? "json";

    const requestedOrgId = searchParams.get("organizationId");

    if (!requestedOrgId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 },
      );
    }

    // Use centralized auth guard
    const ctx = await requireOrgAccess(requestedOrgId, "reports:export", {
      requirePaid: true,
    });

    const where: Record<string, unknown> = {
      site: {
        workspace: { organizationId: ctx.organizationId },
        ...(siteId ? { id: siteId } : {}),
      },
    };

    const health = await collectPlatformHealth(prisma);
    const truth = buildRoutePlatformTruth(health);

    const findings = await prisma.canonicalFinding.findMany({
      where,
      include: {
        occurrences: {
          include: { page: { select: { url: true, title: true } } },
          take: 100,
        },
        evidenceRecords: {
          take: 20,
          orderBy: [{ capturedAt: "desc" }, { createdAt: "desc" }],
        },
        verificationRuns: {
          take: 10,
          orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
        },
        governanceDecisions: {
          take: 10,
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            kind: true,
            status: true,
            rationale: true,
            justification: true,
            expiresAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ impact: "asc" }, { occurrenceCount: "desc" }],
    });

    const report = {
      generatedAt: new Date().toISOString(),
      generatedBy: user.email,
      disclaimer:
        "This report provides evidence of accessibility testing and operator workflow. It does not constitute a guarantee of WCAG conformance.",
      platformTruth: {
        jobPipelinesHealthy: truth.flags.jobPipelinesHealthy,
        workerRunning: truth.flags.workerRunning,
        optionalSubsystemIssues: truth.optionalSubsystemIssues,
      },
      summary: {
        totalFindings: findings.length,
        bySeverity: {
          critical: findings.filter((f) => f.impact === "CRITICAL").length,
          serious: findings.filter((f) => f.impact === "SERIOUS").length,
          moderate: findings.filter((f) => f.impact === "MODERATE").length,
          minor: findings.filter((f) => f.impact === "MINOR").length,
        },
        byEvidenceSource: {
          automatedAxe: findings.filter(
            (f) => f.evidenceSource === "AUTOMATED_AXE",
          ).length,
          manualReview: findings.filter(
            (f) => f.evidenceSource === "MANUAL_REVIEW",
          ).length,
          imported: findings.filter((f) => f.evidenceSource === "IMPORTED")
            .length,
        },
        proofCompleteness: {
          complete: findings.filter((f) => {
            const summary = buildFindingProofSummary({
              evidenceSummary: f.evidenceSummary,
              provenance: f.provenance,
              firstSeenAt: f.firstSeenAt,
              lastSeenAt: f.lastSeenAt,
              reopenedCount: f.reopenedCount,
            });
            return Object.values(summary.completeness).filter(Boolean).length >= 4;
          }).length,
          partial: findings.filter((f) => {
            const summary = buildFindingProofSummary({
              evidenceSummary: f.evidenceSummary,
              provenance: f.provenance,
              firstSeenAt: f.firstSeenAt,
              lastSeenAt: f.lastSeenAt,
              reopenedCount: f.reopenedCount,
            });
            return Object.values(summary.completeness).filter(Boolean).length < 4;
          }).length,
        },
      },
      findings: findings.map((f) => ({
        id: f.id,
        ruleId: f.ruleId,
        impact: f.impact,
        status: f.status,
        truthStatus: f.truthStatus,
        evidenceSource: f.evidenceSource,
        sourceType: f.sourceType,
        targetKind: f.targetKind,
        targetLocator: f.targetLocator,
        description: f.description,
        wcagTags: f.wcagTags,
        wcagCriteria: f.wcagCriteria,
        wcagVersion: f.wcagVersion,
        normalizedRuleKey: f.normalizedRuleKey,
        ruleVersion: f.ruleVersion,
        confidence: f.confidence,
        occurrenceCount: f.occurrenceCount,
        firstSeenAt: f.firstSeenAt,
        lastSeenAt: f.lastSeenAt,
        lastVerifiedAt: f.lastVerifiedAt,
        lastScanRunId: f.lastScanRunId,
        reopenedCount: f.reopenedCount,
        proofSummary: buildFindingProofSummary({
          evidenceSummary: f.evidenceSummary,
          provenance: f.provenance,
          firstSeenAt: f.firstSeenAt,
          lastSeenAt: f.lastSeenAt,
          reopenedCount: f.reopenedCount,
        }),
        evidenceCount: f.evidenceRecords.length,
        latestVerification: f.verificationRuns[0]
          ? {
              status: f.verificationRuns[0].status,
              kind: f.verificationRuns[0].kind,
              completedAt: f.verificationRuns[0].completedAt,
              outcomeSummary: f.verificationRuns[0].outcomeSummary,
            }
          : null,
        governance: f.governanceDecisions.map((decision) => ({
          id: decision.id,
          kind: decision.kind,
          status: decision.status,
          rationale: decision.rationale,
          justification: decision.justification,
          expiresAt: decision.expiresAt,
          createdAt: decision.createdAt,
        })),
        affectedPages: f.occurrences.map((o) => ({
          url: o.page.url,
          title: o.page.title,
          selector: o.selector,
        })),
      })),
    };

    if (format === "csv") {
      const lines = ["Rule ID,Impact,Status,Description,Occurrences,WCAG Tags"];
      for (const f of report.findings) {
        lines.push(
          `"${f.ruleId}","${f.impact}","${f.status}","${f.description.replace(/"/g, '""')}",${f.occurrenceCount},"${f.wcagTags.join("; ")}"`,
        );
      }
      return new NextResponse(lines.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="aros-report-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    return NextResponse.json(report, {
      headers: {
        "Content-Disposition": `attachment; filename="aros-report-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Report generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 },
    );
  }
}
