'use server';

import { enqueueSiteScan } from '@aros/core-services/scan-enqueue';
import { ApiError } from '@aros/shared';
import { prisma } from '@/lib/db';
import { requireSiteAccess } from '@/lib/auth-guard';
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
    const ctx = await requireSiteAccess(siteId, 'scan:start');
    const result = await enqueueSiteScan(
      { prisma },
      {
        siteId: ctx.siteId,
        organizationId: ctx.organizationId,
        crawlRunId: null,
        trigger: 'operator',
        userId: ctx.user.id,
      }
    );

    if (result.ok) {
      if (result.kind === 'queued') {
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

    return {
      status: 'error',
      message: result.message || 'Could not queue verification.',
      variant: 'error',
    };
  } catch (e) {
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

