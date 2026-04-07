"use server";

import { redirect } from "next/navigation";
import { getCrawlQueue, type CrawlJobData } from "@/lib/queue";
import { requireSiteAccess } from "@/lib/auth-guard";
import { ApiError } from "@aros/shared";
import {
  markCrawlRunFailedQueue,
  startCrawlForVerifiedSite,
} from "@/lib/dashboard-org-scoped-prisma";

export async function startCrawlAction(formData: FormData) {
  const siteId = formData.get("siteId") as string;
  if (!siteId) {
    redirect("/sites?error=missing_site_id");
  }

  try {
    const ctx = await requireSiteAccess(siteId, "scan:start", {
      requirePaid: true,
    });

    const outcome = await startCrawlForVerifiedSite({
      siteId: ctx.siteId,
      organizationId: ctx.organizationId,
      userId: ctx.user.id,
    });

    if (outcome.kind === "already_running") {
      redirect(`/sites/${ctx.siteId}`);
    }
    if (outcome.kind === "site_not_found") {
      redirect(`/sites/${ctx.siteId}?error=site_not_found`);
    }

    const { crawlRun, site, config } = outcome;

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
      await markCrawlRunFailedQueue(crawlRun.id, ctx, message);
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
