import type { PrismaClient, FindingStatus } from '@aros/db';
import { hasPermission } from '@aros/config';
import { canOperatorTransition, type FindingStatusValue } from '@aros/shared';
import {
  deriveWorkflowTruthStatus,
  getActiveFindingGovernanceDecision,
} from '@aros/core-services';

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
      site: { workspace: { organizationId } },
    },
    select: {
      id: true,
      status: true,
      siteId: true,
      statusNote: true,
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
  const nextStatus = input.nextStatus as FindingStatus;
  const noteTrimmed = input.note?.trim() || null;
  const noteChanged = noteTrimmed !== (finding.statusNote ?? null);

  if (!canOperatorTransition(from, to)) {
    return { ok: false, code: 'invalid_transition' };
  }

  if (from === to) {
    if (!noteChanged) {
      return { ok: true };
    }

    await input.prisma.$transaction(async (tx) => {
      await tx.canonicalFinding.update({
        where: { id: finding.id },
        data: {
          statusNote: noteTrimmed,
        },
      });
      await tx.auditLog.create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId,
          action: 'finding.status_note_updated',
          entityType: 'CanonicalFinding',
          entityId: finding.id,
          metadata: {
            status: from,
            siteId: finding.siteId,
            noteCleared: noteTrimmed === null,
          },
        },
      });

      if (noteTrimmed) {
        await tx.findingStatusEvent.create({
          data: {
            canonicalFindingId: finding.id,
            fromStatus: from,
            toStatus: nextStatus,
            note: noteTrimmed,
            userId: input.userId,
          },
        });
      }
    });
    return { ok: true };
  }

  const now = new Date();
  const activeDecision = await getActiveFindingGovernanceDecision(input.prisma, finding.id);
  const truthStatus = deriveWorkflowTruthStatus(
    nextStatus,
    activeDecision?.kind ?? null
  );

  await input.prisma.$transaction(async (tx) => {
    await tx.canonicalFinding.update({
      where: { id: finding.id },
      data: {
        status: nextStatus,
        truthStatus,
        statusChangedAt: now,
        statusChangedById: input.userId,
        statusNote: noteTrimmed,
      },
    });
    await tx.findingStatusEvent.create({
      data: {
        canonicalFindingId: finding.id,
        fromStatus: from,
        toStatus: nextStatus,
        note: noteTrimmed,
        userId: input.userId,
      },
    });
    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: 'finding.status_changed',
        entityType: 'CanonicalFinding',
        entityId: finding.id,
        metadata: {
          fromStatus: from,
          toStatus: nextStatus,
          siteId: finding.siteId,
        },
      },
    });
  });

  return { ok: true };
}
