import type { PrismaClient, FindingStatus } from '@aros/db';
import { hasPermission } from '@aros/config';
import { canOperatorTransition, type FindingStatusValue } from '@aros/shared';

export type RemediationTransitionResult =
  | { ok: true }
  | { ok: false; code: 'not_found' | 'forbidden' | 'invalid_transition' | 'invalid_status' };

const ALL_STATUSES: FindingStatus[] = [
  'OPEN',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'RESOLVED',
  'MITIGATED',
  'FALSE_POSITIVE',
  'WONT_FIX',
];

function isFindingStatus(v: string): v is FindingStatus {
  return ALL_STATUSES.includes(v as FindingStatus);
}

/**
 * Scoped load: finding must have at least one occurrence under the org.
 */
export async function loadFindingScopedToOrg(
  prisma: PrismaClient,
  findingId: string,
  organizationId: string
) {
  return prisma.canonicalFinding.findFirst({
    where: {
      id: findingId,
      occurrences: {
        some: { page: { site: { workspace: { organizationId } } } },
      },
    },
    select: {
      id: true,
      status: true,
      siteId: true,
    },
  });
}

export async function transitionFindingRemediationStatus(input: {
  prisma: PrismaClient;
  findingId: string;
  organizationId: string;
  userId: string;
  userRole: import('@aros/db').MemberRole;
  nextStatus: string;
  note?: string | null;
}): Promise<RemediationTransitionResult> {
  if (!hasPermission(input.userRole, 'findings:manage')) {
    return { ok: false, code: 'forbidden' };
  }

  if (!isFindingStatus(input.nextStatus)) {
    return { ok: false, code: 'invalid_status' };
  }

  const finding = await loadFindingScopedToOrg(
    input.prisma,
    input.findingId,
    input.organizationId
  );

  if (!finding) {
    return { ok: false, code: 'not_found' };
  }

  const from = finding.status as FindingStatusValue;
  const to = input.nextStatus as FindingStatusValue;

  if (!canOperatorTransition(from, to)) {
    return { ok: false, code: 'invalid_transition' };
  }

  if (from === to) {
    return { ok: true };
  }

  const now = new Date();
  const noteTrimmed = input.note?.trim() || null;

  await input.prisma.$transaction([
    input.prisma.canonicalFinding.update({
      where: { id: finding.id },
      data: {
        status: input.nextStatus,
        statusChangedAt: now,
        statusChangedById: input.userId,
        ...(noteTrimmed ? { statusNote: noteTrimmed } : {}),
      },
    }),
    input.prisma.findingStatusEvent.create({
      data: {
        canonicalFindingId: finding.id,
        fromStatus: from,
        toStatus: input.nextStatus,
        note: noteTrimmed,
        userId: input.userId,
      },
    }),
    input.prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: 'finding.status_changed',
        entityType: 'CanonicalFinding',
        entityId: finding.id,
        metadata: {
          fromStatus: from,
          toStatus: input.nextStatus,
          siteId: finding.siteId,
        },
      },
    }),
  ]);

  return { ok: true };
}
