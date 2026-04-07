import {
  enqueueSiteScan,
  persistPostCrawlScanKickoffAfterEnqueue,
  type EnqueueSiteScanParams,
  type EnqueueSiteScanResult,
} from "@aros/core-services";
import { prisma } from "@/lib/db";
import type { Prisma } from "@aros/db";

const suggestionOrgScope = (organizationId: string) =>
  ({
    OR: [
      {
        finding: {
          occurrences: {
            some: {
              page: {
                site: { workspace: { organizationId } },
              },
            },
          },
        },
      },
      {
        cluster: {
          site: { workspace: { organizationId } },
        },
      },
    ],
  }) satisfies Prisma.RemediationSuggestionWhereInput;

const reviewTaskOrgScope = (organizationId: string) =>
  ({
    suggestion: suggestionOrgScope(organizationId),
  }) satisfies Prisma.ReviewTaskWhereInput;

export async function loadRemediationSuggestionForOrg(
  suggestionId: string,
  organizationId: string,
) {
  return prisma.remediationSuggestion.findFirst({
    where: { id: suggestionId, ...suggestionOrgScope(organizationId) },
    select: {
      id: true,
      status: true,
      recipeId: true,
      finding: {
        select: {
          site: {
            select: {
              workspace: { select: { organizationId: true } },
            },
          },
        },
      },
      cluster: {
        select: {
          site: {
            select: {
              workspace: { select: { organizationId: true } },
            },
          },
        },
      },
    },
  });
}

export async function updateRemediationSuggestionApproved(
  suggestionId: string,
  organizationId: string,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.remediationSuggestion.updateMany({
      where: {
        id: suggestionId,
        status: { in: ["DRAFT", "VALIDATED"] },
        ...suggestionOrgScope(organizationId),
      },
      data: {
        status: "APPROVED",
        appliedBy: userId,
        appliedAt: new Date(),
      },
    });
    if (updated.count !== 1) {
      return { ok: false as const, reason: "update_mismatch" as const };
    }
    const row = await tx.remediationSuggestion.findFirst({
      where: { id: suggestionId },
      select: { recipeId: true },
    });
    if (row?.recipeId) {
      await tx.remediationRecipe.update({
        where: { id: row.recipeId },
        data: { successCount: { increment: 1 } },
      });
    }
    return { ok: true as const };
  });
}

export async function updateRemediationSuggestionRejected(
  suggestionId: string,
  organizationId: string,
) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.remediationSuggestion.updateMany({
      where: {
        id: suggestionId,
        status: { notIn: ["REJECTED", "APPLIED"] },
        ...suggestionOrgScope(organizationId),
      },
      data: { status: "REJECTED" },
    });
    if (updated.count !== 1) {
      return { ok: false as const, reason: "update_mismatch" as const };
    }
    const row = await tx.remediationSuggestion.findFirst({
      where: { id: suggestionId },
      select: { recipeId: true },
    });
    if (row?.recipeId) {
      await tx.remediationRecipe.update({
        where: { id: row.recipeId },
        data: { rejectionCount: { increment: 1 } },
      });
    }
    return { ok: true as const };
  });
}

export async function updateRemediationSuggestionExported(
  suggestionId: string,
  organizationId: string,
) {
  const updated = await prisma.remediationSuggestion.updateMany({
    where: {
      id: suggestionId,
      status: { in: ["APPROVED", "VALIDATED"] },
      ...suggestionOrgScope(organizationId),
    },
    data: { status: "EXPORTED" },
  });
  return updated.count === 1
    ? ({ ok: true as const })
    : ({ ok: false as const, reason: "update_mismatch" as const });
}

export async function loadReviewTaskForOrg(taskId: string, organizationId: string) {
  return prisma.reviewTask.findFirst({
    where: { id: taskId, ...reviewTaskOrgScope(organizationId) },
    select: {
      id: true,
      status: true,
      suggestion: {
        select: {
          cluster: {
            select: {
              site: {
                select: {
                  workspace: { select: { organizationId: true } },
                },
              },
            },
          },
          finding: {
            select: {
              site: {
                select: {
                  workspace: { select: { organizationId: true } },
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function updateReviewTaskStatusForOrg(
  taskId: string,
  organizationId: string,
  data: Prisma.ReviewTaskUpdateInput,
) {
  const updated = await prisma.reviewTask.updateMany({
    where: { id: taskId, ...reviewTaskOrgScope(organizationId) },
    data,
  });
  return updated.count === 1;
}

export async function createApiKeyForOrg(input: {
  organizationId: string;
  keyHash: string;
  name: string;
  scopes: string[];
  rateLimitPerMinute: number;
  expiresAt: Date | null;
}) {
  return prisma.apiKey.create({
    data: {
      organizationId: input.organizationId,
      keyHash: input.keyHash,
      name: input.name,
      scopes: input.scopes,
      rateLimitPerMinute: input.rateLimitPerMinute,
      expiresAt: input.expiresAt,
    },
    select: {
      id: true,
      name: true,
      scopes: true,
      rateLimitPerMinute: true,
      expiresAt: true,
    },
  });
}

export async function findActiveApiKeyForOrg(organizationId: string, keyId: string) {
  return prisma.apiKey.findFirst({
    where: {
      id: keyId,
      organizationId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      scopes: true,
      rateLimitPerMinute: true,
      expiresAt: true,
    },
  });
}

export async function rotateApiKeyForOrg(
  organizationId: string,
  keyId: string,
  newHash: string,
  existing: {
    name: string;
    scopes: string[];
    rateLimitPerMinute: number;
    expiresAt: Date | null;
  },
) {
  const [newKey] = await prisma.$transaction([
    prisma.apiKey.create({
      data: {
        organizationId,
        keyHash: newHash,
        name: existing.name,
        scopes: existing.scopes,
        rateLimitPerMinute: existing.rateLimitPerMinute,
        expiresAt: existing.expiresAt,
      },
    }),
    prisma.apiKey.delete({
      where: { id: keyId },
    }),
  ]);
  return newKey;
}

export async function revokeApiKeyForOrg(organizationId: string, keyId: string) {
  const key = await prisma.apiKey.findFirst({
    where: {
      id: keyId,
      organizationId,
      isActive: true,
    },
  });
  if (!key) return { ok: false as const };
  await prisma.apiKey.update({
    where: { id: keyId },
    data: { isActive: false },
  });
  return { ok: true as const };
}

export async function listApiKeyUsageForOrg(organizationId: string) {
  return prisma.apiKey.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    include: {
      mcpUsageLogs: {
        select: {
          id: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function startCrawlForVerifiedSite(ctx: {
  siteId: string;
  organizationId: string;
  userId: string;
}) {
  const runningCrawl = await prisma.crawlRun.findFirst({
    where: { siteId: ctx.siteId, status: { in: ["PENDING", "RUNNING"] } },
  });
  if (runningCrawl) {
    return { kind: "already_running" as const };
  }

  const site = await prisma.site.findUnique({
    where: { id: ctx.siteId },
    include: { crawlConfig: true },
  });
  if (!site) {
    return { kind: "site_not_found" as const };
  }

  const config = site.crawlConfig;
  const crawlRun = await prisma.crawlRun.create({
    data: { siteId: ctx.siteId, status: "PENDING" },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "crawl.started",
      entityType: "CrawlRun",
      entityId: crawlRun.id,
    },
  });

  return {
    kind: "started" as const,
    crawlRun,
    site,
    config,
  };
}

export async function markCrawlRunFailedQueue(
  crawlRunId: string,
  ctx: { organizationId: string; user: { id: string }; siteId: string },
  message: string,
) {
  await prisma.crawlRun.update({
    where: { id: crawlRunId },
    data: {
      status: "FAILED",
      errorMessage: `Crawl queue unavailable: ${message}`,
      completedAt: new Date(),
    },
  });
  await prisma.auditLog.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.user.id,
      action: "crawl.enqueue_failed",
      entityType: "CrawlRun",
      entityId: crawlRunId,
      metadata: { siteId: ctx.siteId, message },
    },
  });
}

export async function countScanRunsForOrg(organizationId: string) {
  return prisma.scanRun.count({
    where: { site: { workspace: { organizationId } } },
  });
}

export async function findCompletedCrawlForSiteOrg(
  crawlRunId: string,
  siteId: string,
  organizationId: string,
) {
  return prisma.crawlRun.findFirst({
    where: {
      id: crawlRunId,
      siteId,
      status: "COMPLETED",
      pagesCrawled: { gt: 0 },
      site: { workspace: { organizationId } },
    },
    select: { id: true },
  });
}

export async function setPostCrawlScanKickoffRequested(crawlRunId: string) {
  return prisma.crawlRun.update({
    where: { id: crawlRunId },
    data: { postCrawlScanKickoffStatus: "REQUESTED" },
  });
}

export async function createScanAuditLog(input: {
  organizationId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function updateCrawlConfigAutoScan(
  siteId: string,
  organizationId: string,
  enabled: boolean,
) {
  const updated = await prisma.crawlConfig.updateMany({
    where: { siteId, site: { workspace: { organizationId } } },
    data: { autoScanAfterCrawl: enabled },
  });
  return updated.count === 1;
}

export async function loadMembershipWorkspaceForAddSite(
  userId: string,
  organizationId: string,
) {
  return prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    include: {
      organization: {
        include: {
          workspaces: { take: 1 },
          subscription: true,
        },
      },
    },
  });
}

export async function countSitesForOrg(organizationId: string) {
  return prisma.site.count({
    where: { workspace: { organizationId } },
  });
}

export async function createSiteWithCrawlAndAudit(input: {
  workspaceId: string;
  organizationId: string;
  userId: string;
  name: string;
  domain: string;
  environment: "PRODUCTION" | "STAGING" | "DEVELOPMENT";
  sitemapUrl: string | null;
  maxDepth: number;
  maxPages: number;
  respectRobots: boolean;
  renderJavaScript: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const site = await tx.site.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        domain: input.domain,
        environment: input.environment,
      },
    });

    await tx.crawlConfig.create({
      data: {
        siteId: site.id,
        sitemapUrl: input.sitemapUrl,
        maxDepth: input.maxDepth,
        maxPages: input.maxPages,
        respectRobots: input.respectRobots,
        renderJavaScript: input.renderJavaScript,
      },
    });

    const crawlRun = await tx.crawlRun.create({
      data: {
        siteId: site.id,
        status: "PENDING",
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: "site.created",
        entityType: "Site",
        entityId: site.id,
        metadata: { name: input.name, domain: input.domain },
      },
    });

    return { site, crawlRun };
  });
}

export async function markCrawlRunQueueRetry(crawlRunId: string) {
  return prisma.crawlRun.update({
    where: { id: crawlRunId },
    data: {
      status: "PENDING",
      errorMessage: "Queue not available - will retry",
    },
  });
}

/** Wraps core-services scan enqueue with the app Prisma client (keeps `prisma` out of server actions). */
export async function enqueueSiteScanForDashboard(
  params: EnqueueSiteScanParams,
): Promise<EnqueueSiteScanResult> {
  return enqueueSiteScan({ prisma }, params);
}

export async function persistPostCrawlKickoffAfterEnqueueDashboard(
  crawlRunId: string,
  result: EnqueueSiteScanResult,
) {
  return persistPostCrawlScanKickoffAfterEnqueue(prisma, crawlRunId, result);
}
