import { NextResponse } from 'next/server';
import { requireOrgAccess } from '@/lib/auth-guard';
import { getPlatformHealthPayload } from '@/lib/platform-health';
import { apiError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  context: { params: Promise<{ organizationId: string }> }
) {
  try {
    const { organizationId } = await context.params;
    await requireOrgAccess(organizationId, 'org:system:view');
    const payload = await getPlatformHealthPayload();
    return NextResponse.json({ success: true, data: payload });
  } catch (e) {
    return apiError(e);
  }
}
