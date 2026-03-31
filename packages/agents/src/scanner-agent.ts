import { prisma } from "@aros/db";
import { getSharedScanQueue } from "@aros/shared";
import type {
  AgentContext,
  AgentResult,
  AgentStep,
  AgentEventHandler,
} from "./types";

/**
 * ScannerAgent: Decides what to scan, schedules crawls,
 * monitors scan health, and triggers remediation for new findings.
 *
 * State machine: assess → schedule → monitor → trigger_remediation
 */
export class ScannerAgent {
  private onEvent?: AgentEventHandler;

  constructor(onEvent?: AgentEventHandler) {
    this.onEvent = onEvent;
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();
    const steps: AgentStep[] = [];

    const runStep = async <T>(
      name: string,
      handler: () => Promise<T>,
    ): Promise<T> => {
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
        step.output = output as any;
        step.completedAt = new Date();
        step.durationMs =
          step.completedAt.getTime() - (step.startedAt?.getTime() ?? 0);
        this.onEvent?.({ type: "step_complete", step: name, output });
        return output;
      } catch (err) {
        step.status = "failed";
        step.error = err instanceof Error ? err.message : String(err);
        step.completedAt = new Date();
        step.durationMs =
          step.completedAt.getTime() - (step.startedAt?.getTime() ?? 0);
        this.onEvent?.({ type: "step_error", step: name, error: step.error });
        throw err;
      }
    };

    try {
      if (!context.siteId) throw new Error("siteId required");

      // Step 1: Assess current state
      const assessment = (await runStep("assess", async () => {
        const site = await prisma.site.findUnique({
          where: { id: context.siteId! },
          include: {
            _count: { select: { pages: true, canonicalFindings: true } },
          },
        });

        const lastScan = await prisma.scanRun.findFirst({
          where: { siteId: context.siteId! },
          orderBy: { createdAt: "desc" },
          select: { status: true, completedAt: true, violationsFound: true },
        });

        const openFindings = await prisma.canonicalFinding.count({
          where: { siteId: context.siteId!, status: "OPEN" },
        });

        const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const needsScan =
          !lastScan ||
          lastScan.completedAt === null ||
          lastScan.completedAt < staleThreshold;

        return { site, lastScan, openFindings, needsScan };
      })) as any;

      // Step 2: Schedule scan if needed
      const scheduleResult = (await runStep("schedule", async () => {
        if (!assessment.needsScan) {
          return { action: "skipped", reason: "Recent scan exists" };
        }

        const scanRun = await prisma.scanRun.create({
          data: {
            siteId: context.siteId!,
            status: "QUEUED" as any,
          },
        });

        const queue = getSharedScanQueue();
        await queue.add("scan", {
          scanRunId: scanRun.id,
          siteId: context.siteId,
        });

        return { action: "queued", scanRunId: scanRun.id };
      })) as any;

      // Step 3: Trigger remediation for unresolved findings
      const remediationResult = (await runStep(
        "trigger_remediation",
        async () => {
          const findingsWithoutSuggestions =
            await prisma.canonicalFinding.findMany({
              where: {
                siteId: context.siteId!,
                status: "OPEN",
                suggestions: { none: {} },
              },
              select: { id: true },
              take: 20,
            });

          const { bullmqConnectionOptions } = await import("@aros/shared");
          const { Queue } = await import("bullmq");
          const remQueue = new Queue("remediation", {
            connection: (bullmqConnectionOptions as any)(),
          });

          let queued = 0;
          for (const finding of findingsWithoutSuggestions) {
            await remQueue.add("remediation", {
              findingId: finding.id,
              siteId: context.siteId,
            });
            queued++;
          }

          return { remediationJobsQueued: queued };
        },
      )) as any;

      return {
        success: true,
        steps,
        output: {
          assessment,
          schedule: scheduleResult,
          remediation: remediationResult,
        },
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

