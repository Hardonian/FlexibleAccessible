import { RemediationAgent } from "./remediation-agent";
import { ScannerAgent } from "./scanner-agent";
import { ReporterAgent } from "./reporter-agent";
import type {
  AgentContext,
  AgentResult,
  AgentEventHandler,
  AgentEvent,
} from "./types";

/**
 * AgentOrchestrator: Coordinates multiple agents in a pipeline.
 *
 * Flow: ScannerAgent (assess & schedule) →
 *        RemediationAgent (fix findings) →
 *        ReporterAgent (generate report)
 *
 * Supports parallel execution for independent tasks.
 */
export class AgentOrchestrator {
  private onEvent?: AgentEventHandler;

  constructor(onEvent?: AgentEventHandler) {
    this.onEvent = onEvent;
  }

  async runFullPipeline(context: AgentContext): Promise<{
    scan: AgentResult;
    remediation: AgentResult[];
    report: AgentResult;
  }> {
    const emit = (event: AgentEvent) => this.onEvent?.(event);

    emit({ type: "step_start", step: "orchestrator:scan" });
    const scanner = new ScannerAgent(this.onEvent);
    const scanResult = await scanner.execute(context);
    emit({
      type: "step_complete",
      step: "orchestrator:scan",
      output: scanResult.output,
    });

    // Run remediation on all open findings in parallel batches
    emit({ type: "step_start", step: "orchestrator:remediation" });
    const remediationResults: AgentResult[] = [];

    if (context.siteId) {
      const { prisma } = await import("@aros/db");
      const openFindings = await prisma.canonicalFinding.findMany({
        where: { siteId: context.siteId, status: "OPEN" },
        select: { id: true },
        take: 50,
      });

      // Process in batches of 5
      const batchSize = 5;
      for (let i = 0; i < openFindings.length; i += batchSize) {
        const batch = openFindings.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map((f) => {
            const agent = new RemediationAgent(this.onEvent);
            return agent.execute({ ...context, findingId: f.id });
          }),
        );

        for (const r of results) {
          if (r.status === "fulfilled") {
            remediationResults.push(r.value);
          } else {
            remediationResults.push({
              success: false,
              steps: [],
              output: null,
              error:
                r.reason instanceof Error ? r.reason.message : String(r.reason),
              totalDurationMs: 0,
              tokensUsed: 0,
            });
          }
        }
      }
    }

    emit({
      type: "step_complete",
      step: "orchestrator:remediation",
      output: { count: remediationResults.length },
    });

    // Generate report
    emit({ type: "step_start", step: "orchestrator:report" });
    const reporter = new ReporterAgent(this.onEvent);
    const reportResult = await reporter.execute(context);
    emit({
      type: "step_complete",
      step: "orchestrator:report",
      output: reportResult.output,
    });

    return {
      scan: scanResult,
      remediation: remediationResults,
      report: reportResult,
    };
  }
}
