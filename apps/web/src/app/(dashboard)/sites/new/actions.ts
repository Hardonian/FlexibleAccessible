"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { ApiError } from "@aros/shared";
import { prisma } from "@/lib/db";
import { getCrawlQueue, type CrawlJobData } from "@/lib/queue";
import { resolveDashboardOrgMembership } from "@/lib/route-data-boundary";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import { requireOrgAccess } from "@/lib/auth-guard";

interface AddSiteState {
  error: string | null;
}

export async function addSiteAction(
  _prevState: AddSiteState,
  formData: FormData,
): Promise<AddSiteState> {
  const user = await requireSession();

  const name = (formData.get("name") as string)?.trim();
  const domain = (formData.get("domain") as string)?.trim();
  const sitemapUrl = (formData.get("sitemapUrl") as string)?.trim() || null;
  const environment = (formData.get("environment") as string) || "PRODUCTION";
  const maxDepth = parseInt(formData.get("maxDepth") as string) || 5;
  const maxPages = parseInt(formData.get("maxPages") as string) || 100;
  const respectRobots = formData.get("respectRobots") === "on";
  const renderJavaScript = formData.get("renderJavaScript") === "on";

  if (!name || !domain) {
    return { error: "Name and domain are required" };
  }

  try {
    new URL(domain);
  } catch {
    return {
      error: "Please enter a valid URL including the protocol (https://)",
    };
  }

  const platformTruth = await getRoutePlatformTruth();
  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind !== "ok") {
    return { error: "No organization found. Please contact support." };
  }

  try {
    await requireOrgAccess(orgRes.organizationId, "site:create", {
      requirePaid: true,
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === "SUBSCRIPTION_REQUIRED") {
      return { error: "Upgrade to a paid plan to add and scan private sites." };
    }
    throw error;
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: orgRes.organizationId,
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

  if (!membership || membership.organization.workspaces.length === 0) {
    return { error: "No workspace found. Please contact support." };
  }

  const workspace = membership.organization.workspaces[0];
  const subscription = membership.organization.subscription;

  if (subscription) {
    const siteCount = await prisma.site.count({
      where: { workspace: { organizationId: orgRes.organizationId } },
    });
    if (siteCount >= subscription.maxDomains) {
      return {
        error: `You have reached your plan limit of ${subscription.maxDomains} site(s). Please upgrade.`,
      };
    }
  }

  const effectiveMaxPages = subscription
    ? Math.min(maxPages, subscription.maxPagesPerCrawl)
    : maxPages;

  const result = await prisma.$transaction(async (tx) => {
    const site = await tx.site.create({
      data: {
        workspaceId: workspace.id,
        name,
        domain,
        environment: environment as "PRODUCTION" | "STAGING" | "DEVELOPMENT",
      },
    });

    await tx.crawlConfig.create({
      data: {
        siteId: site.id,
        sitemapUrl,
        maxDepth,
        maxPages: effectiveMaxPages,
        respectRobots,
        renderJavaScript,
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
        organizationId: orgRes.organizationId,
        userId: user.id,
        action: "site.created",
        entityType: "Site",
        entityId: site.id,
        metadata: { name, domain },
      },
    });

    return { site, crawlRun };
  });

  try {
    const jobData: CrawlJobData = {
      crawlRunId: result.crawlRun.id,
      siteId: result.site.id,
      config: {
        sitemapUrl: sitemapUrl ?? undefined,
        maxDepth,
        maxPages: effectiveMaxPages,
        includePatterns: [],
        excludePatterns: [],
        respectRobots,
        renderJavaScript,
        viewports: [
          { width: 1280, height: 720 },
          { width: 375, height: 812 },
        ],
      },
    };
    await getCrawlQueue().add("crawl", jobData, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });
  } catch {
    await prisma.crawlRun.update({
      where: { id: result.crawlRun.id },
      data: {
        status: "PENDING",
        errorMessage: "Queue not available - will retry",
      },
    });
  }

  redirect(`/sites/${result.site.id}`);
}
