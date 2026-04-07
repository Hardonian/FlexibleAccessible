'use server';

import { redirect } from 'next/navigation';
import { ApiError } from '@aros/shared';
import { requireSiteAccess } from '@/lib/auth-guard';
import { logProductEvent, PRODUCT_EVENT_ACTIONS } from '@/lib/product-events';
import {
  countScanRunsForOrg,
  createScanAuditLog,
  enqueueSiteScanForDashboard,
  findCompletedCrawlForSiteOrg,
  persistPostCrawlKickoffAfterEnqueueDashboard,
  setPostCrawlScanKickoffRequested,
} from '@/lib/dashboard-org-scoped-prisma';
import type { ScanSiteActionState } from './scan-action-state';

export async function startSiteScanAction(
  _prev: ScanSiteActionState,
  formData: FormData
): Promise<ScanSiteActionState> {
  const siteId = formData.get('siteId') as string;
  if (!siteId) {
    return { status: 'error', message: 'Missing site.', variant: 'error' };
  }

  try {
    const ctx = await requireSiteAccess(siteId, 'scan:start', {
      requirePaid: true,
    });
    const result = await enqueueSiteScanForDashboard({
      siteId: ctx.siteId,
      organizationId: ctx.organizationId,
      monthlyScanLimit: ctx.subscription?.maxScansPerMonth,
      crawlRunId: null,
      trigger: 'operator',
      userId: ctx.user.id,
    });

    if (result.ok) {
      if (result.kind === 'queued') {
        const priorCount = await countScanRunsForOrg(ctx.organizationId);
        if (priorCount <= 1) {
          await logProductEvent({
            organizationId: ctx.organizationId,
            userId: ctx.user.id,
            action: PRODUCT_EVENT_ACTIONS.first_private_scan_queued,
            metadata: { siteId: ctx.siteId, scanRunId: result.scanRunId },
          });
        }
        return {
          status: 'queued',
          message: 'Queued for verification. Evidence refreshes when the worker finishes this scan.',
          variant: 'neutral',
        };
      }
      if (result.kind === 'already_active') {
        const pending = result.status === 'PENDING';
        return {
          status: pending ? 'already_pending' : 'already_running',
          message: pending
            ? 'Verification is already queued for this site.'
            : 'Verification is already running for this site.',
          variant: 'neutral',
        };
      }
      return {
        status: 'deduped',
        message: 'This crawl was already covered by a completed scan.',
        variant: 'neutral',
      };
    }

    if (result.kind === 'invalid_target') {
      if (result.reason === 'no_pages') {
        return {
          status: 'no_pages',
          message: 'Run a crawl first so there are pages to verify.',
          variant: 'error',
        };
      }
      return { status: 'error', message: 'Site not found.', variant: 'error' };
    }

    if (result.kind === 'queue_unavailable') {
      return {
        status: 'queue_unavailable',
        message:
          'Verification queue is unavailable; nothing was queued. Check Redis and workers, then try again.',
        variant: 'error',
      };
    }

    if (result.kind === 'plan_limit_reached') {
      return {
        status: 'error',
        message: `Monthly scan limit reached (${result.usedThisMonth}/${result.monthlyScanLimit}). Upgrade to continue running private verification scans this month.`,
        variant: 'error',
      };
    }

    return {
      status: 'error',
      message: result.message || 'Could not queue verification.',
      variant: 'error',
    };
  } catch (e) {
    if (e instanceof ApiError && e.code === 'SUBSCRIPTION_REQUIRED') {
      return {
        status: 'error',
        message: 'Upgrade to a paid plan to run private verification scans.',
        variant: 'error',
      };
    }
    if (e instanceof ApiError && e.statusCode === 403) {
      return { status: 'permission_denied', message: 'You do not have permission to start scans.', variant: 'error' };
    }
    if (e instanceof ApiError && e.statusCode === 404) {
      return { status: 'error', message: 'Site not found.', variant: 'error' };
    }
    const msg = e instanceof Error ? e.message : 'Request failed';
    return { status: 'error', message: msg, variant: 'error' };
  }
}

/** Re-attempt scan enqueue for a completed crawl; updates the same canonical kickoff fields as the worker. */
export async function retryPostCrawlScanKickoffAction(formData: FormData) {
  const siteId = formData.get('siteId') as string;
  const crawlRunId = formData.get('crawlRunId') as string;
  if (!siteId || !crawlRunId) {
    redirect(siteId ? `/sites/${siteId}` : '/sites');
  }

  try {
    const ctx = await requireSiteAccess(siteId, 'scan:start', {
      requirePaid: true,
    });
    const crawl = await findCompletedCrawlForSiteOrg(
      crawlRunId,
      ctx.siteId,
      ctx.organizationId
    );
    if (!crawl) {
      redirect(`/sites/${siteId}`);
    }

    await setPostCrawlScanKickoffRequested(crawlRunId);

    const result = await enqueueSiteScanForDashboard({
      siteId: ctx.siteId,
      organizationId: ctx.organizationId,
      monthlyScanLimit: ctx.subscription?.maxScansPerMonth,
      crawlRunId,
      trigger: 'operator',
      userId: ctx.user.id,
    });

    await persistPostCrawlKickoffAfterEnqueueDashboard(crawlRunId, result);

    if (result.ok && result.kind === 'queued') {
      await createScanAuditLog({
        organizationId: ctx.organizationId,
        userId: ctx.user.id,
        action: 'scan.queued',
        entityType: 'CrawlRun',
        entityId: crawlRunId,
        metadata: { siteId: ctx.siteId, crawlRunId, trigger: 'operator_retry' },
      }).catch(() => undefined);
    }

    if (!result.ok && result.kind === 'queue_unavailable') {
      await createScanAuditLog({
        organizationId: ctx.organizationId,
        userId: ctx.user.id,
        action: 'scan.enqueue_failed',
        entityType: 'CrawlRun',
        entityId: crawlRunId,
        metadata: {
          siteId: ctx.siteId,
          scanRunId: result.scanRunId,
          reason: 'queue_unavailable',
          trigger: 'operator_retry',
        },
      }).catch(() => undefined);
    }
  } catch (e) {
    if (e instanceof ApiError && e.code === 'SUBSCRIPTION_REQUIRED') {
      redirect('/settings/billing?status=upgrade_required&from=%2Fsites');
    }
    if (e instanceof ApiError && (e.statusCode === 403 || e.statusCode === 404)) {
      redirect(`/sites/${siteId}`);
    }
    throw e;
  }

  redirect(`/sites/${siteId}`);
}
