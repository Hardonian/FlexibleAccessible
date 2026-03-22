import { prisma } from './db';
import { requireSession, type SessionUser } from './session';
import { hasPermission, type Permission } from '@aros/config';
import { ApiError } from '@aros/shared';
import type { MemberRole } from '@aros/db';

export interface AuthContext {
  user: SessionUser;
  organizationId: string;
  role: MemberRole;
}

export async function requireOrgAccess(
  organizationId: string,
  requiredPermission?: Permission
): Promise<AuthContext> {
  const user = await requireSession();

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId,
      },
    },
  });

  if (!membership) {
    throw ApiError.forbidden('You do not have access to this organization');
  }

  if (requiredPermission && !hasPermission(membership.role, requiredPermission)) {
    throw ApiError.forbidden(`Missing permission: ${requiredPermission}`);
  }

  return {
    user,
    organizationId,
    role: membership.role,
  };
}

export async function requireSiteAccess(
  siteId: string,
  requiredPermission?: Permission
): Promise<AuthContext & { siteId: string; workspaceId: string }> {
  const user = await requireSession();

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      workspace: {
        include: {
          organization: {
            include: {
              memberships: {
                where: { userId: user.id },
                take: 1,
              },
            },
          },
        },
      },
    },
  });

  if (!site || site.workspace.organization.memberships.length === 0) {
    throw ApiError.notFound('Site not found');
  }

  const membership = site.workspace.organization.memberships[0];

  if (requiredPermission && !hasPermission(membership.role, requiredPermission)) {
    throw ApiError.forbidden(`Missing permission: ${requiredPermission}`);
  }

  return {
    user,
    organizationId: site.workspace.organizationId,
    role: membership.role,
    siteId: site.id,
    workspaceId: site.workspaceId,
  };
}
