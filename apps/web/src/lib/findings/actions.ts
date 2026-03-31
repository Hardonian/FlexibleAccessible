'use server';

import { requireSession } from '@/lib/auth'; // Assuming this exists
import { getRoutePlatformTruth } from '@/lib/platform-truth-cache'; // Assuming this exists
import { resolveDashboardOrgMembership } from '@/lib/route-data-boundary';
import { getScopedMembers } from '@/lib/queries/org-scoped-queries';

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