'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireSiteAccess } from '@/lib/auth-guard';

export type AutoScanSettingsState = { ok: true } | { ok: false; error: string };

export async function updateAutoScanAfterCrawlAction(
  _prev: AutoScanSettingsState | undefined,
  formData: FormData
): Promise<AutoScanSettingsState> {
  const siteId = formData.get('siteId') as string;
  if (!siteId) {
    return { ok: false, error: 'Missing site.' };
  }

  try {
    const ctx = await requireSiteAccess(siteId, 'site:manage');
    const enabled = formData.get('autoScanAfterCrawl') === 'on';

    await prisma.crawlConfig.update({
      where: { siteId: ctx.siteId },
      data: { autoScanAfterCrawl: enabled },
    });

    await prisma.auditLog
      .create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.user.id,
          action: 'crawl.auto_scan_after_crawl.updated',
          entityType: 'CrawlConfig',
          entityId: ctx.siteId,
          metadata: { autoScanAfterCrawl: enabled },
        },
      })
      .catch(() => undefined);

    revalidatePath(`/sites/${siteId}`);
    revalidatePath(`/sites/${siteId}/settings`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not save settings.';
    return { ok: false, error: msg };
  }
}
