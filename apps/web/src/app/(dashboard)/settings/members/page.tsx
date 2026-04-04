import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Users } from "lucide-react";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import {
  resolveDashboardOrgMembership,
  runOrgScopedQuery,
} from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { EntitlementWall } from "@/components/monetization/entitlement-wall";
import { getEntitlementState } from "@/lib/auth-guard";
import { hasPermission } from "@aros/config";
import { MembersList } from "./members-list";

export const metadata = { title: "Members - AROS" };

export default async function MembersPage() {
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();

  let canViewSystem = false;
  try {
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      select: { role: true },
    });
    canViewSystem = memberships.some((m) =>
      hasPermission(m.role, "org:system:view"),
    );
  } catch (error) {
    console.warn("[members page] Failed to check system permissions", {
      userId: user.id,
      error,
    });
  }

  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind === "platform_blocked") {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-slate-900">Members</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Members require a working database"
          showSystemLink={canViewSystem}
        >
          <p>
            Member management cannot be loaded until core data services are
            healthy.
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "error") {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-slate-900">Members</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Could not verify organization"
          showSystemLink={canViewSystem}
        >
          <p>{orgRes.message}</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "none") {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-slate-900">Members</h1>
        <RouteReliabilityNotice
          variant="info"
          title="No organization membership"
        >
          <p>You need an organization to manage members.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const orgResult = await runOrgScopedQuery(orgRes, (orgId) =>
    prisma.membership.findFirst({
      where: { userId: user.id, organizationId: orgId },
      include: {
        organization: {
          include: {
            subscription: true,
            memberships: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    }),
  );

  if (!orgResult.ok || !orgResult.data?.organization) {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-slate-900">Members</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Could not load organization"
          showSystemLink={canViewSystem}
        >
          <p>
            {orgResult.ok
              ? "Organization not found or access was revoked."
              : orgResult.message}
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const membership = orgResult.data;
  const org = membership.organization;
  const subscription = org.subscription;
  const entitlement = getEntitlementState(subscription);
  const canManageMembers = hasPermission(membership.role, "org:members:manage");

  if (!entitlement.hasPaidAccess) {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-slate-900">Members</h1>
        <EntitlementWall
          subscription={subscription}
          entitlement={entitlement}
          title="Member management requires a paid plan"
          description="Invite team members and manage roles on paid plans. Upgrade to add collaborators to your accessibility workflow."
        />
        <div className="card">
          <div className="flex items-center gap-3 text-slate-600">
            <Users className="h-5 w-5" />
            <p className="text-sm">
              {org.memberships.length} member
              {org.memberships.length !== 1 ? "s" : ""} currently
            </p>
          </div>
          <div className="mt-4">
            <Link href="/settings/billing" className="btn-primary">
              Upgrade to manage members
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Members</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage team members and their roles in your organization.
        </p>
      </div>

      <MembersList
        organizationId={org.id}
        members={org.memberships}
        currentUserId={user.id}
        currentUserRole={membership.role}
        canManageMembers={canManageMembers}
      />
    </div>
  );
}
