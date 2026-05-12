import { Queue } from "bullmq";
import type { PrismaClient } from "@aros/db";
import { bullmqConnectionOptions, workerLogger } from "@aros/shared";
import {
  currentScheduleWindow,
  parseSupportedScheduleCron,
} from "@aros/core-services";

const ONE_MINUTE_MS = 60_000;

interface CrawlJobData {
  crawlRunId: string;
  siteId: string;
  config: {
    sitemapUrl?: string;
    maxDepth: number;
    maxPages: number;
    includePatterns: string[];
    excludePatterns: string[];
    respectRobots: boolean;
    renderJavaScript: boolean;
    viewports: Array<{ width: number; height: number }>;
    authConfig?: unknown;
    customHeaders?: Record<string, string>;
  };
}

function toCrawlJobData(input: {
  crawlRunId: string;
  siteId: string;
  config: {
    sitemapUrl: string | null;
    maxDepth: number;
    maxPages: number;
    includePatterns: string[];
    excludePatterns: string[];
    respectRobots: boolean;
    renderJavaScript: boolean;
    viewports: unknown;
    authConfig: unknown;
    customHeaders: unknown;
  };
}): CrawlJobData {
  const rawViewports = Array.isArray(input.config.viewports)
    ? input.config.viewports
    : [{ width: 1280, height: 720 }];
  const parsedViewports = rawViewports
    .map((v) => ({ width: Number((v as any)?.width), height: Number((v as any)?.height) }))
    .filter(
      (v) =>
        Number.isFinite(v.width) && Number.isFinite(v.height) && v.width > 0 && v.height > 0,
    );

  return {
    crawlRunId: input.crawlRunId,
    siteId: input.siteId,
    config: {
      sitemapUrl: input.config.sitemapUrl ?? undefined,
      maxDepth: input.config.maxDepth,
      maxPages: input.config.maxPages,
      includePatterns: input.config.includePatterns,
      excludePatterns: input.config.excludePatterns,
      respectRobots: input.config.respectRobots,
      renderJavaScript: input.config.renderJavaScript,
      viewports:
        parsedViewports.length > 0 ? parsedViewports : [{ width: 1280, height: 720 }],
      authConfig: input.config.authConfig ?? undefined,
      customHeaders:
        (input.config.customHeaders as Record<string, string> | null) ?? undefined,
    },
  };
}

export async function runScheduledCrawlTick(prisma: PrismaClient, now = new Date()) {
  const scheduledConfigs = await prisma.crawlConfig.findMany({
    where: { scheduleCron: { not: null } },
    select: {
      siteId: true,
      scheduleCron: true,
      sitemapUrl: true,
      maxDepth: true,
      maxPages: true,
      includePatterns: true,
      excludePatterns: true,
      respectRobots: true,
      renderJavaScript: true,
      viewports: true,
      authConfig: true,
      customHeaders: true,
      site: {
        select: {
          verified: true,
          workspace: {
            select: {
              organizationId: true,
              organization: {
                select: {
                  subscription: {
                    select: { plan: true, status: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (scheduledConfigs.length === 0) {
    return { scanned: 0, enqueued: 0, blocked: 0 };
  }

  const crawlQueue = new Queue("crawl", { connection: bullmqConnectionOptions() });

  let enqueued = 0;
  let blocked = 0;

  try {
    for (const cfg of scheduledConfigs) {
      const schedule = parseSupportedScheduleCron(cfg.scheduleCron);
      const organizationId = cfg.site.workspace.organizationId;

      if (!schedule || !cfg.site.verified) {
        blocked += 1;
        continue;
      }

      const subscription = cfg.site.workspace.organization.subscription;
      const paidStatus =
        subscription &&
        subscription.plan !== "FREE" &&
        ["ACTIVE", "TRIALING"].includes(subscription.status);
      if (!paidStatus) {
        blocked += 1;
        continue;
      }

      const { slotStart, slotEnd } = currentScheduleWindow(schedule, now);

      const [existingInSlot, running] = await Promise.all([
        prisma.crawlRun.findFirst({
          where: {
            siteId: cfg.siteId,
            createdAt: { gte: slotStart, lt: slotEnd },
          },
          select: { id: true },
        }),
        prisma.crawlRun.findFirst({
          where: {
            siteId: cfg.siteId,
            status: { in: ["PENDING", "RUNNING"] },
          },
          select: { id: true },
        }),
      ]);

      if (existingInSlot || running) continue;

      const crawlRun = await prisma.crawlRun.create({
        data: {
          siteId: cfg.siteId,
          status: "PENDING",
          metadata: {
            trigger: "scheduled",
            scheduleCron: schedule,
            scheduledSlotStart: slotStart.toISOString(),
          },
        },
        select: { id: true },
      });

      try {
        const jobData = toCrawlJobData({
          crawlRunId: crawlRun.id,
          siteId: cfg.siteId,
          config: {
            sitemapUrl: cfg.sitemapUrl,
            maxDepth: cfg.maxDepth,
            maxPages: cfg.maxPages,
            includePatterns: cfg.includePatterns,
            excludePatterns: cfg.excludePatterns,
            respectRobots: cfg.respectRobots,
            renderJavaScript: cfg.renderJavaScript,
            viewports: cfg.viewports,
            authConfig: cfg.authConfig,
            customHeaders: cfg.customHeaders,
          },
        });

        await crawlQueue.add("crawl", jobData, {
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
          jobId: `scheduled:${cfg.siteId}:${slotStart.toISOString()}`,
        });

        enqueued += 1;
        await prisma.auditLog.create({
          data: {
            organizationId,
            action: "crawl.scheduled.enqueued",
            entityType: "Site",
            entityId: cfg.siteId,
            metadata: {
              scheduleCron: schedule,
              slotStart: slotStart.toISOString(),
              crawlRunId: crawlRun.id,
            },
          },
        });
      } catch (error) {
        blocked += 1;
        const message = error instanceof Error ? error.message : "Queue add failed";
        await prisma.crawlRun.update({
          where: { id: crawlRun.id },
          data: {
            status: "FAILED",
            errorMessage: `Scheduled crawl enqueue failed: ${message}`,
            completedAt: new Date(),
          },
        });
        await prisma.auditLog
          .create({
            data: {
              organizationId,
              action: "crawl.scheduled.enqueue_failed",
              entityType: "Site",
              entityId: cfg.siteId,
              metadata: {
                scheduleCron: schedule,
                slotStart: slotStart.toISOString(),
                error: message,
              },
            },
          })
          .catch(() => undefined);
      }
    }
  } finally {
    await crawlQueue.close();
  }

  return { scanned: scheduledConfigs.length, enqueued, blocked };
}

export function startScheduledCrawlLoop(prisma: PrismaClient) {
  const tick = async () => {
    try {
      const result = await runScheduledCrawlTick(prisma);
      if (result.enqueued > 0 || result.blocked > 0) {
        workerLogger.info(`[ScheduledCrawl] scanned=${result.scanned} enqueued=${result.enqueued} blocked=${result.blocked}`);
      }
    } catch (error) {
      workerLogger.error("[ScheduledCrawl] tick failed", { error });
    }
  };

  void tick();
  return setInterval(() => {
    void tick();
  }, ONE_MINUTE_MS);
}
