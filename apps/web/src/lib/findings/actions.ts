'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { requireSession } from '@/lib/session';
import { getRoutePlatformTruth } from '@/lib/platform-truth-cache';
import { resolveDashboardOrgMembership } from '@/lib/route-data-boundary';
import { getScopedMembers } from '@/lib/findings/org-scoped-queries';
import { prisma } from '@/lib/db';

export async function getOrganizationMembers() {
  try {
    const user = await requireSession();
    const truth = await getRoutePlatformTruth();
    const orgCtx = await resolveDashboardOrgMembership(user.id, truth);

    if (orgCtx.kind !== 'ok') {
      return { success: false, error: 'Organization not found or platform is unavailable.' };
    }

    const membersResult = await getScopedMembers(orgCtx);

    return membersResult.ok
      ? { success: true, data: membersResult.data }
      : { success: false, error: membersResult.message };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'An unknown error occurred.';
    return { success: false, error: message };
  }
}

export async function removeOrganizationMember(membershipId: string) {
  try {
    const user = await requireSession();
    const truth = await getRoutePlatformTruth();
    const orgCtx = await resolveDashboardOrgMembership(user.id, truth);

    if (orgCtx.kind !== 'ok' || orgCtx.role !== 'ADMIN' && orgCtx.role !== 'OWNER') {
      return { success: false, error: 'Unauthorized: Admin or Owner role required.' };
    }

    // Verify member belongs to same org
    const target = await prisma.membership.findUnique({
      where: { id: membershipId }
    });

    if (!target || target.organizationId !== orgCtx.organizationId) {
      return { success: false, error: 'Member not found in organization.' };
    }

    await prisma.membership.delete({
      where: { id: membershipId }
    });

    revalidatePath('/settings/members');
    revalidateTag('members-list');

    return { success: true };
  } catch (e) {
    console.error('[removeOptimizationMember]', e);
    return { success: false, error: 'Failed to remove member.' };
  }
}