'use server';

import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { resolveDashboardOrgMembership } from '@/lib/route-data-boundary';
import { getRoutePlatformTruth } from '@/lib/platform-truth-cache';
import { transitionFindingRemediationStatus } from '@/lib/findings/remediation-server';

export async function updateFindingStatusAction(formData: FormData) {
  const user = await requireSession();
  const findingId = formData.get('findingId') as string;
  const status = formData.get('status') as string;
  const note = (formData.get('note') as string | null) ?? null;

  if (!findingId || !status) {
    redirect('/findings');
  }

  const platformTruth = await getRoutePlatformTruth();
  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind !== 'ok') {
    redirect('/findings');
  }

  const result = await transitionFindingRemediationStatus({
    prisma,
    findingId,
    organizationId: orgRes.organizationId,
    userId: user.id,
    userRole: orgRes.role,
    nextStatus: status,
    note,
  });

  if (!result.ok) {
    redirect(`/findings/${findingId}?remediation=${result.code}`);
  }

  redirect(`/findings/${findingId}`);
}
