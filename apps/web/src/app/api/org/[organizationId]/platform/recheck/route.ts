import { NextResponse } from 'next/server';
import { requireOrgAccess } from '@/lib/auth-guard';
import { getPlatformHealthPayload } from '@/lib/platform-health';
import { apiError } from '@/lib/api-utils';
import { logOperatorPlatformAction } from '@/lib/operator-platform-audit';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  context: { params: Promise<{ organizationId: string }> }
) {
  try {
    const { organizationId } = await context.params;
    const ctx = await requireOrgAccess(organizationId, 'org:system:manage', {
      requirePaid: true,
    });
    const payload = await getPlatformHealthPayload(organizationId, ctx.user.id);
    await logOperatorPlatformAction({
      organizationId,
      userId: ctx.user.id,
      action: 'platform.recheck',
      outcome: 'success',
      metadata: {
        readiness: payload.report.bootstrap.readiness,
        checkedAt: payload.report.checkedAt,
      },
    });
    return NextResponse.json({
      success: true,
      data: {
        kind: 'synchronous_recheck',
        checkedAt: payload.report.checkedAt,
        payload,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
