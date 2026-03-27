import { ApiError } from '@aros/shared';
import { prisma } from '@/lib/db';
import type { ParsedOperatorPlatformFlags } from '@aros/core-services';
import {
  applyScopedOperatorFlagsUpdate,
  backfillLegacyOperatorFlagsForOrgRecord,
  parseOperatorFlagsForOrganization,
  type LegacyBackfillResult,
  resolveOperatorFlagsForOrganization,
} from './operator-org-flags';

export {
  applyScopedOperatorFlagsUpdate,
  backfillLegacyOperatorFlagsForOrgRecord,
  parseOperatorFlagsForOrganization,
  type LegacyBackfillResult,
  resolveOperatorFlagsForOrganization,
} from './operator-org-flags';

export async function loadProductFlagsRecord(): Promise<Record<string, unknown>> {
  const row = await prisma.platformState.findUnique({
    where: { id: 'platform' },
    select: { productFlags: true },
  });
  const raw = row?.productFlags;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  return {};
}

export async function saveProductFlagsRecord(next: Record<string, unknown>) {
  await prisma.platformState.update({
    where: { id: 'platform' },
    data: { productFlags: next as any },
  });
}

async function assertPlatformInstalled() {
  const exists = await prisma.platformState.findUnique({ where: { id: 'platform' }, select: { id: true } });
  if (!exists) {
    throw ApiError.badRequest('Platform is not installed in the database; run migrations and bootstrap before using operator actions.');
  }
}

export async function updateOperatorFlagsForOrganization(
  organizationId: string,
  mutator: (current: ParsedOperatorPlatformFlags) => ParsedOperatorPlatformFlags
) {
  await assertPlatformInstalled();

  const merged = await loadProductFlagsRecord();
  const parsed = parseOperatorFlagsForOrganization(merged, organizationId);
  const updated = mutator(parsed);
  const next = applyScopedOperatorFlagsUpdate(merged, organizationId, updated);
  await saveProductFlagsRecord(next);
  return updated;
}

export async function backfillLegacyOperatorFlagsForOrganization(organizationId: string): Promise<LegacyBackfillResult> {
  await assertPlatformInstalled();

  const merged = await loadProductFlagsRecord();
  const { next, result } = backfillLegacyOperatorFlagsForOrgRecord(merged, organizationId);

  if (result.migrated) {
    await saveProductFlagsRecord(next);
  }

  return result;
}
