import { NextResponse } from 'next/server';
import { requireOrgAccess } from '@/lib/auth-guard';
import { apiError } from '@/lib/api-utils';
import { evaluateLegacyRetirementForOperator } from '@/lib/operator-legacy-retirement';
import { logOperatorPlatformAction } from '@/lib/operator-platform-audit';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  context: { params: Promise<{ organizationId: string }> }
) {
  try {
    const { organizationId } = await context.params;
    const ctx = await requireOrgAccess(organizationId, 'org:system:manage');
    const evaluation = await evaluateLegacyRetirementForOperator(ctx.user.id, { organizationId });

    await logOperatorPlatformAction({
      organizationId,
      userId: ctx.user.id,
      action: 'platform.legacy_flags.retirement_evaluated',
      outcome: 'success',
      metadata: {
        scope: evaluation.readiness.evaluationScope,
        readiness: evaluation.readiness.status,
        inspectedOrganizationCount: evaluation.readiness.inspectedOrganizationCount,
        fallbackOrganizationCount: evaluation.readiness.fallbackOrganizationCount,
      },
    });

    const blocked = !evaluation.readiness.canSafelyPruneLegacyKeys;
    if (blocked) {
      await logOperatorPlatformAction({
        organizationId,
        userId: ctx.user.id,
        action: 'platform.legacy_flags.retirement_blocked',
        outcome: 'blocked',
        metadata: {
          reason: evaluation.readiness.reason,
          readiness: evaluation.readiness.status,
          fallbackOrganizationCount: evaluation.readiness.fallbackOrganizationCount,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        evaluation,
        prune: {
          allowed: false,
          reason: evaluation.readiness.reason,
        },
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
