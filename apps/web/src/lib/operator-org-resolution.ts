import { hasPermission, type Permission } from "@aros/config";
import type { MemberRole } from "@aros/db";

export type OperatorMembershipRow = {
  organizationId: string;
  role: MemberRole;
  createdAt: Date;
};

/**
 * Picks which org an operator console should scope to.
 * Must match dashboard layout semantics: prefer `aros_active_org` when the user
 * is eligible for that org, otherwise oldest membership that has the permission.
 */
export function resolveOperatorScopedMembership(
  rows: OperatorMembershipRow[],
  preferredOrganizationId: string | undefined,
  permission: Permission,
): { organizationId: string; role: MemberRole } | null {
  const eligible = rows
    .filter((row) => hasPermission(row.role, permission))
    .sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

  if (eligible.length === 0) {
    return null;
  }

  if (preferredOrganizationId) {
    const match = eligible.find(
      (row) => row.organizationId === preferredOrganizationId,
    );
    if (match) {
      return {
        organizationId: match.organizationId,
        role: match.role,
      };
    }
  }

  const first = eligible[0];
  return {
    organizationId: first.organizationId,
    role: first.role,
  };
}
