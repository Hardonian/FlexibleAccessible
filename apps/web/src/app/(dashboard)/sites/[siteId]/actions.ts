"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCrawlQueue, type CrawlJobData } from "@/lib/queue";
import { requireSiteAccess } from "@/lib/auth-guard";
import { ApiError } from "@aros/shared";

export async function startCrawlAction(formData: FormData) {
  const siteId = formData.get("siteId") as string;
  if (!siteId) {
    redirect("/sites?error=missing_site_id");
  }

  try {
    const ctx = await requireSiteAccess(siteId, "scan:start", {
      requirePaid: true,
    });

    // Check for running crawl (scoped to the site we verified access to)
    const runningCrawl = await prisma.crawlRun.findFirst({
      where: { siteId: ctx.siteId, status: { in: ["PENDING", "RUNNING"] } },
    });
    if (runningCrawl) {
      redirect(`/sites/${ctx.siteId}`);
    }

    const site = await prisma.site.findUnique({
      where: { id: ctx.siteId },
      include: { crawlConfig: true },
    });

    if (!site) {
      redirect(`/sites/${ctx.siteId}?error=site_not_found`);
    }

    const config = site.crawlConfig;
    const crawlRun = await prisma.crawlRun.create({
      data: { siteId: ctx.siteId, status: "PENDING" },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: ctx.organizationId,
        userId: ctx.user.id,
        action: "crawl.started",
        entityType: "CrawlRun",
        entityId: crawlRun.id,
      },
    });

    try {
      const jobData: CrawlJobData = {
        crawlRunId: crawlRun.id,
        siteId: ctx.siteId,
        config: {
          sitemapUrl: config?.sitemapUrl ?? undefined,
          maxDepth: config?.maxDepth ?? 5,
          maxPages: config?.maxPages ?? 100,
          includePatterns: config?.includePatterns ?? [],
          excludePatterns: config?.excludePatterns ?? [],
          respectRobots: config?.respectRobots ?? true,
          renderJavaScript: config?.renderJavaScript ?? true,
          viewports: (config?.viewports as Array<{
            width: number;
            height: number;
          }>) ?? [{ width: 1280, height: 720 }],
        },
      };
      await getCrawlQueue().add("crawl", jobData, {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Queue add failed";
      await prisma.crawlRun.update({
        where: { id: crawlRun.id },
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
          entityId: crawlRun.id,
          metadata: { siteId: ctx.siteId, message },
        },
      });
      redirect(`/sites/${ctx.siteId}?crawl_error=queue_unavailable`);
    }

    redirect(`/sites/${ctx.siteId}`);
  } catch (e) {
    if (e instanceof ApiError && e.code === "SUBSCRIPTION_REQUIRED") {
      redirect("/settings/billing?status=upgrade_required&from=%2Fsites");
    }
    if (
      e instanceof ApiError &&
      (e.statusCode === 403 || e.statusCode === 404)
    ) {
      redirect(`/sites/${siteId}`);
    }
    throw e;
  }
}
