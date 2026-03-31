import { prisma } from "@aros/db";
import type {
  AgentContext,
  AgentResult,
  AgentEventHandler,
} from "./types";
import { BaseAgent } from "./base-agent";
import type { CanonicalFinding, IssueCluster, RemediationSuggestion, ScanRun } from "@aros/db";

// Define interfaces for step outputs
type AggregateData = {
  findings: Pick<CanonicalFinding, 'ruleId' | 'impact' | 'status' | 'wcagTags' | 'occurrenceCount' | 'description'>[];
  clusters: Pick<IssueCluster, 'name' | 'severity' | 'pageCount' | 'findingCount'>[];
  scanRuns: Pick<ScanRun, 'id' | 'status' | 'violationsFound' | 'pagesScanned' | 'completedAt' | 'createdAt'>[];
  suggestions: Pick<RemediationSuggestion, 'status' | 'confidence' | 'type'>[];
};

type ReportMetrics = {
  totalFindings: number;
  openFindings: number;
  resolvedFindings: number;
  resolutionRate: number;
  byImpact: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
  autoFixableFindings: number;
  autoFixableRate: number;
  totalSuggestions: number;
  approvedSuggestions: number;
  avgConfidence: number;
};

// Could be moved to a shared config file
const AUTO_FIXABLE_RULES = [
  "image-alt",
  "button-name",
  "link-name",
  "label",
  "html-has-lang",
  "document-title",
  "heading-order",
];

/**
 * ReporterAgent: Generates conformance reports, executive summaries,
 * and evidence packages for accessibility audits.
 */
export class ReporterAgent extends BaseAgent {
  constructor(onEvent?: AgentEventHandler) {
    super(onEvent);
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    this.startTime = Date.now();

    try {
      if (!context.siteId) throw new Error("siteId required");

      // Step 1: Aggregate findings
      const data = await this.runStep("aggregate", async (): Promise<AggregateData> => {
        const [findings, clusters, scanRuns, suggestions] = await Promise.all([
          prisma.canonicalFinding.findMany({
            where: { siteId: context.siteId! },
            select: {
              ruleId: true,
              impact: true,
              status: true,
              wcagTags: true,
              occurrenceCount: true,
              description: true,
            },
          }),
          prisma.issueCluster.findMany({
            where: { siteId: context.siteId! },
            select: {
              name: true,
              severity: true,
              pageCount: true,
              findingCount: true,
            },
          }),
          prisma.scanRun.findMany({
            where: { siteId: context.siteId! },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              status: true,
              violationsFound: true,
              pagesScanned: true,
              completedAt: true,
              createdAt: true,
            },
          }),
          prisma.remediationSuggestion.findMany({
            where: { finding: { siteId: context.siteId! } },
            select: { status: true, confidence: true, type: true },
          }),
        ]);

        return { findings, clusters, scanRuns, suggestions };
      });

      // Step 2: Compute metrics
      const metrics = await this.runStep("compute_metrics", async (): Promise<ReportMetrics> => {
        const { findings, suggestions } = data;

        const total = findings.length;
        
        const byStatus: Record<string, number> = {};
        const byImpact: Record<string, number> = {};

        for (const f of findings) {
          byStatus[f.status] = (byStatus[f.status] || 0) + 1;
          byImpact[f.impact] = (byImpact[f.impact] || 0) + 1;
        }

        const autoFixable = findings.filter((f) =>
          AUTO_FIXABLE_RULES.includes(f.ruleId),
        ).length;

        const resolvedCount =
          (byStatus["RESOLVED"] ?? 0) + (byStatus["MITIGATED"] ?? 0);
        
        const avgConfidence =
          suggestions.length > 0
            ? suggestions.reduce((sum, s) => sum + s.confidence, 0) /
              suggestions.length
            : 0;

        return {
          totalFindings: total,
          openFindings:
            (byStatus["OPEN"] ?? 0) + (byStatus["IN_PROGRESS"] ?? 0),
          resolvedFindings: resolvedCount,
          resolutionRate:
            total > 0 ? Math.round((resolvedCount / total) * 100) : 0,
          byImpact: {
            critical: byImpact["CRITICAL"] ?? 0,
            serious: byImpact["SERIOUS"] ?? 0,
            moderate: byImpact["MODERATE"] ?? 0,
            minor: byImpact["MINOR"] ?? 0,
          },
          autoFixableFindings: autoFixable,
          autoFixableRate:
            total > 0 ? Math.round((autoFixable / total) * 100) : 0,
          totalSuggestions: suggestions.length,
          approvedSuggestions: suggestions.filter(
            (s) => s.status === "APPROVED" || s.status === "EXPORTED",
          ).length,
          avgConfidence: Math.round(avgConfidence * 100),
        };
      });

      // Step 3: Generate report
      const report = await this.runStep("generate_report", async () => {
        const report = await (prisma as any).report.create({ // Assuming 'report' model exists
          data: {
            siteId: context.siteId!,
            type: "CONFORMANCE",
            title: `Conformance Report - ${new Date().toLocaleDateString()}`,
            content: {
              generatedAt: new Date().toISOString(),
              metrics,
              clusters: data.clusters.slice(0, 20),
              recentScans: data.scanRuns.slice(0, 5),
              disclaimer:
                "Automated scanning detects approximately 30-40% of WCAG 2.2 criteria. Manual expert review is required for full conformance assessment.",
            } as any, // Prisma JSON
            summary: `${metrics.totalFindings} findings (${metrics.openFindings} open, ${metrics.resolvedFindings} resolved). ${metrics.resolutionRate}% resolution rate. ${metrics.autoFixableRate}% auto-fixable.`,
          },
        });

        return { reportId: report.id, summary: report.summary };
      });

      return this.createSuccessResult({ metrics, report });
    } catch (err) {
      return this.createFailureResult(err);
    }
  }
}
