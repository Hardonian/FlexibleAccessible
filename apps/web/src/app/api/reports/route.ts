import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { requireCanonicalOrgAccess } from "@/lib/server-org-boundary";
import {
  collectPlatformHealth,
  buildRoutePlatformTruth,
} from "@aros/core-services";
import { buildFindingProofSummary } from "@/lib/findings/proof-summary";
import { summarizeFindingFamilies } from "@/lib/findings/family-summary";
import { scoreFindingPriority } from "@/lib/findings/finding-priority";
import { listFindingsForReport } from "@/lib/reports/org-scoped-queries";

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
    const ctx = await requireCanonicalOrgAccess(requestedOrgId, "reports:export", {
      requirePaid: true,
    });

    const health = await collectPlatformHealth(prisma);
    const truth = buildRoutePlatformTruth(health);

    const findings = await listFindingsForReport(ctx, siteId);
    type ReportFinding = (typeof findings)[number];

    const familySummaryByRuleId = summarizeFindingFamilies(
      findings.map((finding: ReportFinding) => ({
        ruleId: finding.ruleId,
        firstSeenAt: finding.firstSeenAt,
        lastSeenAt: finding.lastSeenAt,
        reopenedCount: finding.reopenedCount,
        status: finding.status,
        distinctScanRunsObserved: finding.distinctScanRunsObserved,
      })),
    );

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
          critical: findings.filter((f: ReportFinding) => f.impact === "CRITICAL").length,
          serious: findings.filter((f: ReportFinding) => f.impact === "SERIOUS").length,
          moderate: findings.filter((f: ReportFinding) => f.impact === "MODERATE").length,
          minor: findings.filter((f: ReportFinding) => f.impact === "MINOR").length,
        },
        byEvidenceSource: {
          automatedAxe: findings.filter(
            (f: ReportFinding) => f.evidenceSource === "AUTOMATED_AXE",
          ).length,
          manualReview: findings.filter(
            (f: ReportFinding) => f.evidenceSource === "MANUAL_REVIEW",
          ).length,
          imported: findings.filter((f: ReportFinding) => f.evidenceSource === "IMPORTED")
            .length,
        },
        proofCompleteness: {
          complete: findings.filter((f: ReportFinding) => {
            const summary = buildFindingProofSummary({
              evidenceSummary: f.evidenceSummary,
              provenance: f.provenance,
              firstSeenAt: f.firstSeenAt,
              lastSeenAt: f.lastSeenAt,
              reopenedCount: f.reopenedCount,
              distinctScanRunsObserved: f.distinctScanRunsObserved,
              distinctScanRunsAbsentWhenOpen: f.distinctScanRunsAbsentWhenOpen,
              evidenceSource: f.evidenceSource,
              sourceType: f.sourceType,
            });
            return Object.values(summary.completeness).filter(Boolean).length >= 4;
          }).length,
          partial: findings.filter((f: ReportFinding) => {
            const summary = buildFindingProofSummary({
              evidenceSummary: f.evidenceSummary,
              provenance: f.provenance,
              firstSeenAt: f.firstSeenAt,
              lastSeenAt: f.lastSeenAt,
              reopenedCount: f.reopenedCount,
              distinctScanRunsObserved: f.distinctScanRunsObserved,
              distinctScanRunsAbsentWhenOpen: f.distinctScanRunsAbsentWhenOpen,
              evidenceSource: f.evidenceSource,
              sourceType: f.sourceType,
            });
            return Object.values(summary.completeness).filter(Boolean).length < 4;
          }).length,
        },
        recurringAcrossScanRuns: findings.filter(
          (f: ReportFinding) => f.distinctScanRunsObserved > 1,
        ).length,
      },
      findings: findings.map((f: ReportFinding) => ({
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
          distinctScanRunsObserved: f.distinctScanRunsObserved,
          distinctScanRunsAbsentWhenOpen: f.distinctScanRunsAbsentWhenOpen,
          evidenceSource: f.evidenceSource,
          sourceType: f.sourceType,
        }),
        triagePriority: scoreFindingPriority({
          impact: f.impact,
          truthStatus: f.truthStatus,
          distinctScanRunsObserved: f.distinctScanRunsObserved,
          occurrenceCount: f.occurrenceCount,
          reopenedCount: f.reopenedCount,
        }),
        evidenceCount: f.evidenceRecords.length,
        familySummary: familySummaryByRuleId[f.ruleId] ?? null,
        latestVerification: f.verificationRuns[0]
          ? {
              status: f.verificationRuns[0].status,
              kind: f.verificationRuns[0].kind,
              completedAt: f.verificationRuns[0].completedAt,
              outcomeSummary: f.verificationRuns[0].outcomeSummary,
            }
          : null,
        governance: f.governanceDecisions.map((decision: ReportFinding["governanceDecisions"][number]) => ({
          id: decision.id,
          kind: decision.kind,
          status: decision.status,
          rationale: decision.rationale,
          justification: decision.justification,
          expiresAt: decision.expiresAt,
          createdAt: decision.createdAt,
        })),
        affectedPages: f.occurrences.map((o: ReportFinding["occurrences"][number]) => ({
          url: o.page.url,
          title: o.page.title,
          selector: o.selector,
        })),
      })),
    };

    if (format === "csv") {
      const lines = [
        "Rule ID,Impact,Status,Truth Status,Change Signal,Comparison Basis,Scan Runs Observed,Absent While Open (runs),Triage Score,Triage Reasons,Proof Completeness,Family Active,Family Regressed,Family Multi-Run,Description,Occurrences,WCAG Tags",
      ];
      for (const f of report.findings) {
        const proofCompletenessScore = Object.values(f.proofSummary.completeness).filter(Boolean).length;
        const reasons = f.triagePriority.reasons.join(" | ").replace(/"/g, '""');
        lines.push(
          `"${f.ruleId}","${f.impact}","${f.status}","${f.truthStatus}","${f.proofSummary.changedSinceLastRun}","${f.proofSummary.comparisonBasis}",${f.proofSummary.recurrence.distinctScanRunsObserved},${f.proofSummary.recurrence.distinctScanRunsAbsentWhenOpen},${f.triagePriority.score.toFixed(0)},"${reasons}",${proofCompletenessScore},${f.familySummary?.activeFindings ?? 0},${f.familySummary?.regressedFindings ?? 0},${f.familySummary?.recurringAcrossScanRunsFindings ?? 0},"${f.description.replace(/"/g, '""')}",${f.occurrenceCount},"${f.wcagTags.join("; ")}"`,
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
