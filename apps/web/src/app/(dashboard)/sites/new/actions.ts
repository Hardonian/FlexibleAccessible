'use server';

import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { getCrawlQueue, type CrawlJobData } from '@/lib/queue';

interface AddSiteState {
  error: string | null;
}

export async function addSiteAction(
  _prevState: AddSiteState,
  formData: FormData
): Promise<AddSiteState> {
  const user = await requireSession();

  const name = (formData.get('name') as string)?.trim();
  const domain = (formData.get('domain') as string)?.trim();
  const sitemapUrl = (formData.get('sitemapUrl') as string)?.trim() || null;
  const environment = (formData.get('environment') as string) || 'PRODUCTION';
  const maxDepth = parseInt(formData.get('maxDepth') as string) || 5;
  const maxPages = parseInt(formData.get('maxPages') as string) || 100;
  const respectRobots = formData.get('respectRobots') === 'on';
  const renderJavaScript = formData.get('renderJavaScript') === 'on';

  if (!name || !domain) {
    return { error: 'Name and domain are required' };
  }

  // Validate URL
  try {
    new URL(domain);
  } catch {
    return { error: 'Please enter a valid URL including the protocol (https://)' };
  }

  // Find user's org and workspace
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
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
    return { error: 'No workspace found. Please contact support.' };
  }

  const workspace = membership.organization.workspaces[0];
  const subscription = membership.organization.subscription;

  // Check quota
  if (subscription) {
    const siteCount = await prisma.site.count({
      where: { workspace: { organizationId: membership.organizationId } },
    });
    if (siteCount >= subscription.maxDomains) {
      return { error: `You have reached your plan limit of ${subscription.maxDomains} site(s). Please upgrade.` };
    }
  }

  // Enforce maxPages from subscription
  const effectiveMaxPages = subscription
    ? Math.min(maxPages, subscription.maxPagesPerCrawl)
    : maxPages;

  const result = await prisma.$transaction(async (tx) => {
    const site = await tx.site.create({
      data: {
        workspaceId: workspace.id,
        name,
        domain,
        environment: environment as 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT',
      },
    });

    const config = await tx.crawlConfig.create({
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
        status: 'PENDING',
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: membership.organizationId,
        userId: user.id,
        action: 'site.created',
        entityType: 'Site',
        entityId: site.id,
        metadata: { name, domain },
      },
    });

    return { site, config, crawlRun };
  });

  // Queue crawl job
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
    await getCrawlQueue().add('crawl', jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  } catch {
    // Queue may not be available in dev - update status
    await prisma.crawlRun.update({
      where: { id: result.crawlRun.id },
      data: { status: 'PENDING', errorMessage: 'Queue not available - will retry' },
    });
  }

  redirect(`/sites/${result.site.id}`);
}
