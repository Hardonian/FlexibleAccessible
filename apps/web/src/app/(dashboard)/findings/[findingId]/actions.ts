'use server';

import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { resolveDashboardOrgMembership } from '@/lib/route-data-boundary';
import { getRoutePlatformTruth } from '@/lib/platform-truth-cache';
import {
  createFindingGovernanceDecision,
  revokeFindingGovernanceDecision,
} from '@aros/core-services';
import { transitionFindingRemediationStatus } from '@/lib/findings/remediation-server';
import { getEntitlementState } from '@/lib/auth-guard';

async function redirectIfUpgradeRequired(organizationId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    select: {
      plan: true,
      status: true,
      maxDomains: true,
      maxPagesPerCrawl: true,
      maxScansPerMonth: true,
      maxSeats: true,
      aiEnabled: true,
      aiTokenLimit: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  });

  if (!getEntitlementState(subscription).hasPaidAccess) {
    redirect('/settings/billing?status=upgrade_required&from=%2Ffindings');
  }
}

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

  await redirectIfUpgradeRequired(orgRes.organizationId);

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

export async function createFindingGovernanceDecisionAction(formData: FormData) {
  const user = await requireSession();
  const findingId = formData.get('findingId') as string;
  const kind = formData.get('kind') as string;
  const rationale = formData.get('rationale') as string;
  const justification = (formData.get('justification') as string | null) ?? null;
  const expiresAtRaw = (formData.get('expiresAt') as string | null) ?? null;

  if (!findingId) {
    redirect('/findings');
  }

  const platformTruth = await getRoutePlatformTruth();
  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind !== 'ok') {
    redirect(`/findings/${findingId}?governance=not_found`);
  }

  await redirectIfUpgradeRequired(orgRes.organizationId);

  const expiresAt = expiresAtRaw?.trim() ? new Date(expiresAtRaw) : null;
  const result = await createFindingGovernanceDecision({
    prisma,
    findingId,
    organizationId: orgRes.organizationId,
    userId: user.id,
    userRole: orgRes.role,
    kind,
    rationale,
    justification,
    expiresAt,
  });

  if (!result.ok) {
    redirect(`/findings/${findingId}?governance=${result.code}`);
  }

  redirect(`/findings/${findingId}`);
}

export async function revokeFindingGovernanceDecisionAction(formData: FormData) {
  const user = await requireSession();
  const findingId = formData.get('findingId') as string;
  const decisionId = formData.get('decisionId') as string;

  if (!findingId || !decisionId) {
    redirect(findingId ? `/findings/${findingId}` : '/findings');
  }

  const platformTruth = await getRoutePlatformTruth();
  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind !== 'ok') {
    redirect(`/findings/${findingId}?governance=not_found`);
  }

  await redirectIfUpgradeRequired(orgRes.organizationId);

  const result = await revokeFindingGovernanceDecision({
    prisma,
    decisionId,
    organizationId: orgRes.organizationId,
    userId: user.id,
    userRole: orgRes.role,
  });

  if (!result.ok) {
    redirect(`/findings/${findingId}?governance=${result.code}`);
  }

  redirect(`/findings/${findingId}`);
}
