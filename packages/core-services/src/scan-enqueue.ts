import { Queue } from 'bullmq';
import type { PrismaClient, ScanStatus } from '@aros/db';
import { bullmqConnectionOptions } from '@aros/shared';

export const SCAN_QUEUE_NAME = 'scan' as const;

export type ScanEnqueueTrigger = 'crawl.completed' | 'operator' | 'api';

export interface EnqueueSiteScanParams {
  siteId: string;
  organizationId: string;
  /** When set, used for idempotency against repeated crawl-completion signals. */
  crawlRunId?: string | null;
  trigger: ScanEnqueueTrigger;
  userId?: string | null;
}

export type EnqueueSiteScanResult =
  | {
      ok: true;
      kind: 'queued';
      scanRunId: string;
      bullmqJobId: string;
    }
  | {
      ok: true;
      kind: 'already_active';
      scanRunId: string;
      status: ScanStatus;
    }
  | {
      ok: true;
      kind: 'deduped';
      reason: 'crawl_already_scanned';
      scanRunId: string;
    }
  | {
      ok: false;
      kind: 'invalid_target';
      reason: 'site_not_found' | 'no_pages';
    }
  | {
      ok: false;
      kind: 'queue_unavailable';
      message: string;
      scanRunId: string;
    }
  | {
      ok: false;
      kind: 'internal_error';
      message: string;
    };

const ACTIVE_STATUSES: ScanStatus[] = ['PENDING', 'RUNNING'];

function scanQueue() {
  return new Queue(SCAN_QUEUE_NAME, { connection: bullmqConnectionOptions() });
}

export interface EnqueueSiteScanDeps {
  prisma: PrismaClient;
  queue?: Pick<Queue, 'add' | 'close'>;
}

/**
 * Canonical path: create ScanRun (PENDING), then persist BullMQ job. Tenant scope must be validated by caller.
 */
export async function enqueueSiteScan(
  deps: EnqueueSiteScanDeps,
  params: EnqueueSiteScanParams
): Promise<EnqueueSiteScanResult> {
  const { prisma } = deps;
  const { siteId, organizationId, crawlRunId, trigger, userId } = params;

  try {
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        workspace: { organizationId },
      },
      select: { id: true },
    });
    if (!site) {
      return { ok: false, kind: 'invalid_target', reason: 'site_not_found' };
    }

    const pageCount = await prisma.page.count({ where: { siteId } });
    if (pageCount === 0) {
      return { ok: false, kind: 'invalid_target', reason: 'no_pages' };
    }

    if (crawlRunId) {
      const completedForCrawl = await prisma.scanRun.findFirst({
        where: { crawlRunId, status: 'COMPLETED' },
        select: { id: true },
      });
      if (completedForCrawl) {
        return {
          ok: true,
          kind: 'deduped',
          reason: 'crawl_already_scanned',
          scanRunId: completedForCrawl.id,
        };
      }

      const activeForCrawl = await prisma.scanRun.findFirst({
        where: { crawlRunId, status: { in: ACTIVE_STATUSES } },
        select: { id: true, status: true },
      });
      if (activeForCrawl) {
        return {
          ok: true,
          kind: 'already_active',
          scanRunId: activeForCrawl.id,
          status: activeForCrawl.status,
        };
      }
    }

    const activeForSite = await prisma.scanRun.findFirst({
      where: { siteId, status: { in: ACTIVE_STATUSES } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true },
    });
    if (activeForSite) {
      return {
        ok: true,
        kind: 'already_active',
        scanRunId: activeForSite.id,
        status: activeForSite.status,
      };
    }

    const scanRun = await prisma.scanRun.create({
      data: {
        siteId,
        crawlRunId: crawlRunId ?? undefined,
        status: 'PENDING',
      },
    });

    const jobPayload = { scanRunId: scanRun.id, siteId };
    const bullmqJobId = `scanRun:${scanRun.id}`;
    const queueInstance = deps.queue ?? scanQueue();
    const shouldClose = !deps.queue;

    try {
      await queueInstance.add('scan', jobPayload, {
        jobId: bullmqJobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      });
    } catch (e) {
      if (shouldClose) {
        await queueInstance.close().catch(() => undefined);
      }
      const message = e instanceof Error ? e.message : 'Queue add failed';
      await prisma.scanRun
        .update({
          where: { id: scanRun.id },
          data: {
            status: 'FAILED',
            errorMessage: `Queue unavailable: ${message}`,
            completedAt: new Date(),
          },
        })
        .catch(() => undefined);
      console.error('[enqueueSiteScan] queue add failed', {
        siteId,
        scanRunId: scanRun.id,
        trigger,
        message,
      });
      return {
        ok: false,
        kind: 'queue_unavailable',
        message,
        scanRunId: scanRun.id,
      };
    }

    if (shouldClose) {
      await queueInstance.close().catch(() => undefined);
    }

    await prisma.auditLog
      .create({
        data: {
          organizationId,
          userId: userId ?? undefined,
          action: 'scan.queued',
          entityType: 'ScanRun',
          entityId: scanRun.id,
          metadata: {
            siteId,
            trigger,
            crawlRunId: crawlRunId ?? null,
            bullmqJobId,
          },
        },
      })
      .catch((err) => {
        console.error('[enqueueSiteScan] audit log failed', err);
      });

    console.log('[enqueueSiteScan] queued', {
      siteId,
      scanRunId: scanRun.id,
      trigger,
      crawlRunId: crawlRunId ?? null,
      bullmqJobId,
    });

    return {
      ok: true,
      kind: 'queued',
      scanRunId: scanRun.id,
      bullmqJobId,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('[enqueueSiteScan] failed', { siteId, message });
    return { ok: false, kind: 'internal_error', message };
  }
}
