import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireOrgAccess } from '@/lib/auth-guard';
import { apiError } from '@/lib/api-utils';
import { logOperatorPlatformAction } from '@/lib/operator-platform-audit';
import { updateOperatorFlagsForOrganization } from '@/lib/operator-product-flags';
import { getPlatformHealthPayload } from '@/lib/platform-health';
import { validateSuppressedOptionalDiagnosticIds } from '@/lib/operator-preferences-validation';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  suppressedOptionalDiagnosticIds: z.array(z.string().min(3).max(256)).max(32),
});

export async function PATCH(
  req: Request,
  context: { params: Promise<{ organizationId: string }> }
) {
  try {
    const { organizationId } = await context.params;
    const ctx = await requireOrgAccess(organizationId, 'org:system:manage');
    const json = await req.json().catch(() => null);
    const parsedBody = bodySchema.safeParse(json);
    if (!parsedBody.success) {
      await logOperatorPlatformAction({
        organizationId,
        userId: ctx.user.id,
        action: 'platform.operator_prefs.updated',
        outcome: 'validation_failed',
        metadata: { reason: 'invalid_body' },
      });
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request body', details: parsedBody.error.flatten() },
        },
        { status: 400 }
      );
    }

    const ids = parsedBody.data.suppressedOptionalDiagnosticIds;
    const validation = validateSuppressedOptionalDiagnosticIds(ids);
    if (!validation.ok) {
      const invalid = validation.invalid;
      await logOperatorPlatformAction({
        organizationId,
        userId: ctx.user.id,
        action: 'platform.operator_prefs.updated',
        outcome: 'validation_failed',
        metadata: { invalidIds: invalid },
      });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_DIAGNOSTIC_IDS',
            message: 'Only optional core-service diagnostics (svc:<serviceId>) may be suppressed.',
            details: { invalid },
          },
        },
        { status: 400 }
      );
    }

    await updateOperatorFlagsForOrganization(organizationId, (current) => ({
      ...current,
      prefs: {
        ...current.prefs,
        suppressedOptionalDiagnosticIds: [...new Set(ids)],
      },
    }));

    await logOperatorPlatformAction({
      organizationId,
      userId: ctx.user.id,
      action: 'platform.operator_prefs.updated',
      outcome: 'success',
      metadata: { count: ids.length },
    });

    const payload = await getPlatformHealthPayload(organizationId);
    return NextResponse.json({ success: true, data: { suppressedOptionalDiagnosticIds: ids, payload } });
  } catch (e) {
    return apiError(e);
  }
}
