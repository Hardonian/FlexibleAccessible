import { hasPermission } from '@aros/config';
import type { MemberRole } from '@aros/db';
import { prisma } from '@/lib/db';
import {
  deriveLegacyDependenceStatus,
  resolveOperatorFlagsForOrganization,
  type LegacyDependenceStatus,
} from './operator-org-flags';

export interface LegacyRetirementOrgInventoryRow {
  organizationId: string;
  dependence: LegacyDependenceStatus;
  requiresRepair: boolean;
}

export interface LegacyRetirementReadiness {
  evaluationScope: 'operator_manage_scope';
  status: 'fallback_detected' | 'no_fallback_observed' | 'unknown';
  inspectedOrganizationCount: number;
  fallbackOrganizationCount: number;
  fallbackOrganizationIds: string[];
  canSafelyPruneLegacyKeys: false;
  reason: string;
}

export interface LegacyRetirementEvaluation {
  inventory: LegacyRetirementOrgInventoryRow[];
  readiness: LegacyRetirementReadiness;
}

export async function evaluateLegacyRetirementForOperator(userId: string): Promise<LegacyRetirementEvaluation> {
  const [memberships, platformRow] = await Promise.all([
    prisma.membership.findMany({
      where: { userId },
      select: { organizationId: true, role: true },
      orderBy: { organizationId: 'asc' },
    }),
    prisma.platformState.findUnique({
      where: { id: 'platform' },
      select: { productFlags: true },
    }),
  ]);

  const manageableOrgIds = memberships
    .filter((membership) => hasPermission(membership.role as MemberRole, 'org:system:manage'))
    .map((membership) => membership.organizationId);

  const flagsRecord =
    platformRow?.productFlags && typeof platformRow.productFlags === 'object' && !Array.isArray(platformRow.productFlags)
      ? (platformRow.productFlags as Record<string, unknown>)
      : {};

  const inventory = manageableOrgIds.map((organizationId) => {
    const resolution = resolveOperatorFlagsForOrganization(flagsRecord, organizationId);
    const dependence = deriveLegacyDependenceStatus(resolution);
    return {
      organizationId,
      dependence,
      requiresRepair: dependence === 'legacy_fallback',
    };
  });

  const fallbackOrganizationIds = inventory.filter((row) => row.requiresRepair).map((row) => row.organizationId);
  const inspectedOrganizationCount = inventory.length;
  const fallbackOrganizationCount = fallbackOrganizationIds.length;
  const status =
    inspectedOrganizationCount === 0 ? 'unknown' : fallbackOrganizationCount > 0 ? 'fallback_detected' : 'no_fallback_observed';

  const reason =
    status === 'unknown'
      ? 'No organizations with org:system:manage were inspectable for this operator.'
      : 'Evaluation is limited to organizations this operator can manage; global prune safety is intentionally not asserted.';

  return {
    inventory,
    readiness: {
      evaluationScope: 'operator_manage_scope',
      status,
      inspectedOrganizationCount,
      fallbackOrganizationCount,
      fallbackOrganizationIds,
      canSafelyPruneLegacyKeys: false,
      reason,
    },
  };
}
