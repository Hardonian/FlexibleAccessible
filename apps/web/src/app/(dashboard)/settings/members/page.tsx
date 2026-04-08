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
import { TruthBadge } from "@/components/truth/truth-badge";

export const metadata = { title: "Members" };

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

  const pendingInviteCount = await runOrgScopedQuery(orgRes, (orgId) =>
    prisma.auditLog.count({
      where: { organizationId: orgId, action: "member:invite_pending" },
    }),
  );
  const pendingInvites = pendingInviteCount.ok ? pendingInviteCount.data : 0;
  const seatsUsed = org.memberships.length + pendingInvites;
  const seatCap = subscription?.maxSeats ?? 1;
  const seatsAtOrOverCap = seatsUsed >= seatCap;

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

      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900">Seat usage</h2>
        <p className="mt-1 text-sm text-slate-500">
          Members + pending invites consume seats. Seat limits are enforced server-side.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-slate-500">Members</p>
            <p className="font-semibold text-slate-900">{org.memberships.length}</p>
          </div>
          <div>
            <p className="text-slate-500">Pending invites</p>
            <p className="font-semibold text-slate-900">{pendingInvites}</p>
          </div>
          <div>
            <p className="text-slate-500">Seat cap</p>
            <p className="font-semibold text-slate-900">{seatCap}</p>
          </div>
        </div>
        {seatsAtOrOverCap ? (
          <p className="mt-3 text-sm text-amber-800">
            Seat cap reached. Remove pending invites or upgrade before adding members.
            <Link href="/settings/billing" className="ml-1 font-medium underline">Open billing</Link>
          </p>
        ) : null}
      </div>

      <MembersList
        organizationId={org.id}
        members={org.memberships}
        currentUserId={user.id}
        currentUserRole={membership.role}
        canManageMembers={canManageMembers}
      />

      <div className="card space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Enterprise admin controls</h2>
        <p className="text-sm text-slate-600">Posture by feature in this deployment:</p>
        <ul className="space-y-2 text-sm text-slate-700">
          <li><TruthBadge state="partial" className="mr-2" />Invites are recorded and seat-checked; outbound invite email is not automatic.</li>
          <li><TruthBadge state="environment_dependent" className="mr-2" />OIDC SSO depends on deployment env and operator configuration.</li>
          <li><TruthBadge state="staged" className="mr-2" />SCIM and directory sync are staged, not implemented in this build.</li>
        </ul>
        <Link href={`/api/org/${org.id}/audit-log`} className="text-sm font-medium text-brand-700 hover:underline">
          Open org audit-log API
        </Link>
      </div>
    </div>
  );
}
