import { prisma } from '@/lib/db';

const PLATFORM_ACTIONS = [
  'platform.recheck',
  'platform.issue.acknowledged',
  'platform.operator_prefs.updated',
  'platform.legacy_flags.fallback_detected',
  'platform.legacy_flags.backfill',
] as const;

export type PlatformAuditAction = (typeof PLATFORM_ACTIONS)[number];

export async function logOperatorPlatformAction(input: {
  organizationId: string;
  userId: string;
  action: PlatformAuditAction;
  outcome: 'success' | 'blocked' | 'validation_failed' | 'forbidden';
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      action: input.action,
      entityType: 'Platform',
      entityId: 'platform',
      metadata: {
        outcome: input.outcome,
        ...(input.metadata ?? {}),
      },
    },
  });
}

export async function getRecentPlatformAuditEntries(organizationId: string, take = 12) {
  return prisma.auditLog.findMany({
    where: {
      organizationId,
      action: { in: [...PLATFORM_ACTIONS] },
    },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      action: true,
      metadata: true,
      createdAt: true,
      userId: true,
    },
  });
}

export type RecentPlatformAuditEntry = Awaited<ReturnType<typeof getRecentPlatformAuditEntries>>[number];
