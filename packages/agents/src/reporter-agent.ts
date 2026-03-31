import { prisma } from "@aros/db";
import type {
  AgentContext,
  AgentResult,
  AgentStep,
  AgentEventHandler,
} from "./types";

/**
 * ReporterAgent: Generates conformance reports, executive summaries,
 * and evidence packages for accessibility audits.
 */
export class ReporterAgent {
  private onEvent?: AgentEventHandler;

  constructor(onEvent?: AgentEventHandler) {
    this.onEvent = onEvent;
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();
    const steps: AgentStep[] = [];

    const runStep = async (
      name: string,
      handler: () => Promise<unknown>,
    ): Promise<unknown> => {
      const step: AgentStep = {
        name,
        status: "running",
        startedAt: new Date(),
      };
      steps.push(step);
      this.onEvent?.({ type: "step_start", step: name });
      try {
        const output = await handler();
        step.status = "completed";
        step.output = output;
        step.completedAt = new Date();
        step.durationMs =
          step.completedAt.getTime() - (step.startedAt?.getTime() ?? 0);
        this.onEvent?.({ type: "step_complete", step: name, output });
        return output;
      } catch (err) {
        step.status = "failed";
        step.error = err instanceof Error ? err.message : String(err);
        step.completedAt = new Date();
        this.onEvent?.({ type: "step_error", step: name, error: step.error });
        throw err;
      }
    };

    try {
      if (!context.siteId) throw new Error("siteId required");

      // Step 1: Aggregate findings
      const data = await runStep("aggregate", async () => {
        const findings = await prisma.canonicalFinding.findMany({
          where: { siteId: context.siteId! },
          select: {
            ruleId: true,
            impact: true,
            status: true,
            wcagTags: true,
            occurrenceCount: true,
            description: true,
          },
        });

        const clusters = await prisma.issueCluster.findMany({
          where: { siteId: context.siteId! },
          select: {
            name: true,
            severity: true,
            pageCount: true,
            findingCount: true,
          },
        });

        const scanRuns = await prisma.scanRun.findMany({
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
        });

        const suggestions = await prisma.remediationSuggestion.findMany({
          where: { canonicalFinding: { siteId: context.siteId! } },
          select: { status: true, confidence: true, type: true },
        });

        return { findings, clusters, scanRuns, suggestions };
      });

      // Step 2: Compute metrics
      const metrics = await runStep("compute_metrics", async () => {
        const findings = data.findings as Array<{
          impact: string;
          status: string;
          ruleId: string;
          occurrenceCount: number;
        }>;
        const suggestions = data.suggestions as Array<{
          status: string;
          confidence: number;
        }>;

        const total = findings.length;
        const byStatus = Object.groupBy(findings, (f) => f.status);
        const byImpact = Object.groupBy(findings, (f) => f.impact);

        const autoFixable = findings.filter((f) =>
          [
            "image-alt",
            "button-name",
            "link-name",
            "label",
            "html-has-lang",
            "document-title",
            "heading-order",
          ].includes(f.ruleId),
        ).length;

        const resolvedCount =
          (byStatus["RESOLVED"]?.length ?? 0) +
          (byStatus["MITIGATED"]?.length ?? 0);
        const avgConfidence =
          suggestions.length > 0
            ? suggestions.reduce((sum, s) => sum + s.confidence, 0) /
              suggestions.length
            : 0;

        return {
          totalFindings: total,
          openFindings:
            (byStatus["OPEN"]?.length ?? 0) +
            (byStatus["IN_PROGRESS"]?.length ?? 0),
          resolvedFindings: resolvedCount,
          resolutionRate:
            total > 0 ? Math.round((resolvedCount / total) * 100) : 0,
          byImpact: {
            critical: byImpact["CRITICAL"]?.length ?? 0,
            serious: byImpact["SERIOUS"]?.length ?? 0,
            moderate: byImpact["MODERATE"]?.length ?? 0,
            minor: byImpact["MINOR"]?.length ?? 0,
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
      const report = await runStep("generate_report", async () => {
        const report = await prisma.report.create({
          data: {
            siteId: context.siteId!,
            type: "CONFORMANCE",
            title: `Conformance Report - ${new Date().toLocaleDateString()}`,
            content: {
              generatedAt: new Date().toISOString(),
              metrics,
              clusters: (
                data.clusters as Array<{
                  name: string;
                  severity: string;
                  pageCount: number;
                }>
              ).slice(0, 20),
              recentScans: (
                data.scanRuns as Array<{
                  id: string;
                  status: string;
                  violationsFound: number;
                  pagesScanned: number;
                }>
              ).slice(0, 5),
              disclaimer:
                "Automated scanning detects approximately 30-40% of WCAG 2.2 criteria. Manual expert review is required for full conformance assessment.",
            } as any,
            summary: `${metrics.totalFindings} findings (${metrics.openFindings} open, ${metrics.resolvedFindings} resolved). ${metrics.resolutionRate}% resolution rate. ${metrics.autoFixableRate}% auto-fixable.`,
          },
        });

        return { reportId: report.id, summary: report.summary };
      });

      return {
        success: true,
        steps,
        output: { metrics, report },
        totalDurationMs: Date.now() - startTime,
        tokensUsed: 0,
      };
    } catch (err) {
      return {
        success: false,
        steps,
        output: null,
        error: err instanceof Error ? err.message : String(err),
        totalDurationMs: Date.now() - startTime,
        tokensUsed: 0,
      };
    }
  }
}
