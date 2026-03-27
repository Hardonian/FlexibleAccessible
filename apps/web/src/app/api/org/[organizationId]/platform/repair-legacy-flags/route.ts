import { NextResponse } from 'next/server';
import { requireOrgAccess } from '@/lib/auth-guard';
import { apiError } from '@/lib/api-utils';
import { logOperatorPlatformAction } from '@/lib/operator-platform-audit';
import { backfillLegacyOperatorFlagsForOrganization } from '@/lib/operator-product-flags';
import { getPlatformHealthPayload } from '@/lib/platform-health';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  context: { params: Promise<{ organizationId: string }> }
) {
  try {
    const { organizationId } = await context.params;
    const ctx = await requireOrgAccess(organizationId, 'org:system:manage');

    console.info('[platform-legacy-flags] repair initiated', { organizationId, userId: ctx.user.id });

    await logOperatorPlatformAction({
      organizationId,
      userId: ctx.user.id,
      action: 'platform.legacy_flags.backfill',
      outcome: 'success',
      metadata: { phase: 'initiated' },
    });

    const result = await backfillLegacyOperatorFlagsForOrganization(organizationId);

    if (result.source === 'legacy_fallback') {
      await logOperatorPlatformAction({
        organizationId,
        userId: ctx.user.id,
        action: 'platform.legacy_flags.fallback_detected',
        outcome: 'success',
        metadata: { detectedBy: 'repair_endpoint' },
      });
    }

    console.info('[platform-legacy-flags] repair completed', {
      organizationId,
      userId: ctx.user.id,
      status: result.status,
      source: result.source,
      migrated: result.migrated,
    });

    await logOperatorPlatformAction({
      organizationId,
      userId: ctx.user.id,
      action: 'platform.legacy_flags.backfill',
      outcome: result.migrated ? 'success' : 'blocked',
      metadata: {
        phase: 'completed',
        status: result.status,
        source: result.source,
        migrated: result.migrated,
      },
    });

    const payload = await getPlatformHealthPayload(organizationId, ctx.user.id);

    return NextResponse.json({
      success: true,
      data: {
        result,
        payload,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
