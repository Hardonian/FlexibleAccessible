'use server';

import { revalidatePath } from 'next/cache';
import { requireSiteAccess } from '@/lib/auth-guard';
import {
  createScanAuditLog,
  updateCrawlAutomationSettings,
  upsertGitHubRepoMappingForSite,
} from '@/lib/dashboard-org-scoped-prisma';
import { parseSupportedScheduleCron } from '@aros/core-services';

export type AutoScanSettingsState = { ok: true } | { ok: false; error: string };

export async function updateGitHubMappingAction(formData: FormData): Promise<void> {
  const siteId = formData.get('siteId') as string;
  const repoOwner = (formData.get('repoOwner') as string)?.trim();
  const repoName = (formData.get('repoName') as string)?.trim();
  const defaultBranch = (formData.get('defaultBranch') as string)?.trim() || 'main';
  const basePath = (formData.get('basePath') as string)?.trim() || '/';

  if (!siteId || !repoOwner || !repoName) {
    throw new Error('Owner and repository name are required');
  }

  const ctx = await requireSiteAccess(siteId, 'site:manage', {
    requirePaid: true,
  });

  await upsertGitHubRepoMappingForSite(ctx.siteId, {
    repoOwner,
    repoName,
    defaultBranch,
    basePath,
  });

  revalidatePath(`/sites/${siteId}`);
  revalidatePath(`/sites/${siteId}/settings`);
}

function normalizeScheduleCron(input: FormDataEntryValue | null): string | null {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (!raw || raw === 'off') return null;
  return parseSupportedScheduleCron(raw);
}

export async function updateAutoScanAfterCrawlAction(
  _prev: AutoScanSettingsState | undefined,
  formData: FormData
): Promise<AutoScanSettingsState> {
  const siteId = formData.get('siteId') as string;
  if (!siteId) {
    return { ok: false, error: 'Missing site.' };
  }

  try {
    const ctx = await requireSiteAccess(siteId, 'site:manage', {
      requirePaid: true,
    });
    const enabled = formData.get('autoScanAfterCrawl') === 'on';
    const scheduleCron = normalizeScheduleCron(formData.get('scheduleCron'));

    if (formData.get('scheduleCron') && scheduleCron === null && formData.get('scheduleCron') !== 'off') {
      return { ok: false, error: 'Unsupported scan cadence.' };
    }

    const updated = await updateCrawlAutomationSettings(
      ctx.siteId,
      ctx.organizationId,
      { autoScanAfterCrawl: enabled, scheduleCron }
    );
    if (!updated) {
      return { ok: false, error: 'Could not save settings.' };
    }

    await createScanAuditLog({
      organizationId: ctx.organizationId,
      userId: ctx.user.id,
      action: 'crawl.automation_settings.updated',
      entityType: 'CrawlConfig',
      entityId: ctx.siteId,
      metadata: { autoScanAfterCrawl: enabled, scheduleCron },
    }).catch(() => undefined);

    revalidatePath(`/sites/${siteId}`);
    revalidatePath(`/sites/${siteId}/settings`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not save settings.';
    return { ok: false, error: msg };
  }
}
