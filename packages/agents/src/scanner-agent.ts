import { prisma } from "@aros/db";
import type { Site, ScanRun } from "@aros/db";
import { getSharedScanQueue } from "@aros/shared";
import type {
  AgentContext,
  AgentResult,
  AgentEventHandler,
} from "./types";
import { BaseAgent } from "./base-agent";

const SCAN_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
const REMEDIATION_TRIGGER_LIMIT = 20;

interface AssessmentOutput {
  site: (Site & { _count: { pages: number; canonicalFindings: number } }) | null;
  lastScan: Pick<ScanRun, 'status' | 'completedAt' | 'violationsFound'> | null;
  openFindings: number;
  needsScan: boolean;
}

/**
 * ScannerAgent: Decides what to scan, schedules crawls,
 * monitors scan health, and triggers remediation for new findings.
 *
 * State machine: assess → schedule → trigger_remediation
 */
export class ScannerAgent extends BaseAgent {
  constructor(onEvent?: AgentEventHandler) {
    super(onEvent);
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    this.startTime = Date.now();

    try {
      if (!context.siteId) throw new Error("siteId required");

      // Step 1: Assess current state
      const assessment = await this.runStep("assess", async (): Promise<AssessmentOutput> => {
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

        const staleThreshold = new Date(Date.now() - SCAN_STALE_THRESHOLD_MS);
        const needsScan =
          !lastScan ||
          lastScan.completedAt === null ||
          lastScan.completedAt < staleThreshold;

        return { site, lastScan, openFindings, needsScan };
      });

      // Step 2: Schedule scan if needed
      const scheduleResult = await this.runStep("schedule", async () => {
        if (!assessment.needsScan) {
          // Manually update step status as it's being skipped, not failed.
          const step = this.steps.find(s => s.name === 'schedule');
          if (step) step.status = 'skipped';
          return { action: "skipped", reason: "Recent scan exists" };
        }

        const scanRun = await prisma.scanRun.create({
          data: {
            siteId: context.siteId!,
            status: "PENDING",
          },
        });

        // Assuming getSharedScanQueue is a reliable way to get the queue instance
        const queue = getSharedScanQueue();
        await queue.add("scan", {
          scanRunId: scanRun.id,
          siteId: context.siteId,
        });

        return { action: "queued", scanRunId: scanRun.id };
      });

      // Step 3: Trigger remediation for unresolved findings
      const remediationResult = await this.runStep(
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
              take: REMEDIATION_TRIGGER_LIMIT,
            });

          if (findingsWithoutSuggestions.length === 0) {
            return { remediationJobsQueued: 0, reason: "No open findings need suggestions." };
          }

          // Lazily import queue dependencies to keep agent startup light.
          const { bullmqConnectionOptions } = await import("@aros/shared");
          const { Queue } = await import("bullmq");
          const remediationQueue = new Queue("remediation", {
            connection: bullmqConnectionOptions(),
          });

          const jobs = findingsWithoutSuggestions.map(finding => ({
            name: "remediation",
            data: {
              findingId: finding.id,
              siteId: context.siteId,
            }
          }));

          await remediationQueue.addBulk(jobs);
          // It's good practice to close the queue connection if it's not a shared singleton.
          await remediationQueue.close();

          return { remediationJobsQueued: jobs.length };
        },
      );

      return this.createSuccessResult({
        assessment,
        schedule: scheduleResult,
        remediation: remediationResult,
      });
    } catch (err) {
      return this.createFailureResult(err);
    }
  }
}
