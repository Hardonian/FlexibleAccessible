import { NextResponse } from 'next/server';
import { z } from 'zod';
import { collectPlatformHealth, derivePlatformDiagnostics } from '@aros/core-services';
import { requireOrgAccess } from '@/lib/auth-guard';
import { prisma } from '@/lib/db';
import { apiError } from '@/lib/api-utils';
import { logOperatorPlatformAction } from '@/lib/operator-platform-audit';
import { parseOperatorFlagsForOrganization } from '@/lib/operator-org-flags';
import { updateOperatorFlagsForOrganization } from '@/lib/operator-product-flags';
import { getPlatformHealthPayload } from '@/lib/platform-health';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  issueId: z.string().min(1).max(256),
});

export async function POST(
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
        action: 'platform.issue.acknowledged',
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
    const { issueId } = parsedBody.data;

    const report = await collectPlatformHealth(prisma);
    const flags = parseOperatorFlagsForOrganization(report.operatorPlatformFlags, organizationId);
    const { issues } = derivePlatformDiagnostics(report, flags);
    const known = issues.some((i) => i.id === issueId);
    if (!known) {
      await logOperatorPlatformAction({
        organizationId,
        userId: ctx.user.id,
        action: 'platform.issue.acknowledged',
        outcome: 'validation_failed',
        metadata: { issueId, reason: 'unknown_issue' },
      });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNKNOWN_ISSUE',
            message: 'No active diagnostic matches this id after the latest check.',
          },
        },
        { status: 400 }
      );
    }

    await updateOperatorFlagsForOrganization(organizationId, (current) => {
      const next = new Set(current.acknowledgements.acknowledgedIssueIds);
      next.add(issueId);
      return {
        ...current,
        acknowledgements: {
          acknowledgedIssueIds: [...next],
          updatedAt: new Date().toISOString(),
        },
      };
    });

    await logOperatorPlatformAction({
      organizationId,
      userId: ctx.user.id,
      action: 'platform.issue.acknowledged',
      outcome: 'success',
      metadata: { issueId },
    });

    const payload = await getPlatformHealthPayload(organizationId, ctx.user.id);
    return NextResponse.json({ success: true, data: { issueId, payload } });
  } catch (e) {
    return apiError(e);
  }
}
