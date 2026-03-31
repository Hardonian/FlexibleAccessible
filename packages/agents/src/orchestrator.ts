import { RemediationAgent } from "./remediation-agent";
import { ScannerAgent } from "./scanner-agent";
import { ReporterAgent } from "./reporter-agent";
import type {
  AgentContext,
  AgentResult,
  AgentEventHandler,
  AgentEvent,
} from "./types";
import { prisma } from "@aros/db";

const REMEDIATION_FINDINGS_LIMIT = 50;
const REMEDIATION_BATCH_SIZE = 5;

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

  private emit(event: AgentEvent) {
    this.onEvent?.(event);
  }

  private async runScanner(context: AgentContext): Promise<AgentResult> {
    this.emit({ type: "step_start", step: "orchestrator:scan" });
    const scanner = new ScannerAgent(this.onEvent);
    const scanResult = await scanner.execute(context);
    this.emit({
      type: "step_complete",
      step: "orchestrator:scan",
      output: scanResult.output,
    });
    return scanResult;
  }

  private async runRemediation(context: AgentContext): Promise<AgentResult[]> {
    this.emit({ type: "step_start", step: "orchestrator:remediation" });
    if (!context.siteId) {
      this.emit({
        type: "step_complete",
        step: "orchestrator:remediation",
        output: { count: 0, reason: "siteId not provided" },
      });
      return [];
    }

    const openFindings = await prisma.canonicalFinding.findMany({
      where: { siteId: context.siteId, status: "OPEN" },
      select: { id: true },
      take: REMEDIATION_FINDINGS_LIMIT,
    });

    if (openFindings.length === 0) {
      this.emit({
        type: "step_complete",
        step: "orchestrator:remediation",
        output: { count: 0, reason: "No open findings to remediate" },
      });
      return [];
    }

    const remediationResults: AgentResult[] = [];
    for (let i = 0; i < openFindings.length; i += REMEDIATION_BATCH_SIZE) {
      const batch = openFindings.slice(i, i + REMEDIATION_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((f) => {
          const agent = new RemediationAgent(this.onEvent);
          return agent.execute({ ...context, findingId: f.id });
        }),
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          remediationResults.push(result.value);
        } else {
          // Create a structured failure result for better logging
          remediationResults.push({
            success: false,
            steps: [],
            output: null,
            error:
              result.reason instanceof Error ? result.reason.message : String(result.reason),
            totalDurationMs: 0,
            tokensUsed: 0,
          });
        }
      }
    }

    this.emit({
      type: "step_complete",
      step: "orchestrator:remediation",
      output: { count: remediationResults.length },
    });
    return remediationResults;
  }

  private async runReporter(context: AgentContext): Promise<AgentResult> {
    this.emit({ type: "step_start", step: "orchestrator:report" });
    const reporter = new ReporterAgent(this.onEvent);
    const reportResult = await reporter.execute(context);
    this.emit({
      type: "step_complete",
      step: "orchestrator:report",
      output: reportResult.output,
    });
    return reportResult;
  }

  async runFullPipeline(context: AgentContext): Promise<{
    scan: AgentResult;
    remediation: AgentResult[];
    report: AgentResult;
  }> {
    const scanResult = await this.runScanner(context);

    // Run remediation on all open findings in parallel batches
    const remediationResults = await this.runRemediation(context);

    // Generate report
    const reportResult = await this.runReporter(context);

    return {
      scan: scanResult,
      remediation: remediationResults,
      report: reportResult,
    };
  }
}
