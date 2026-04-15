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
import { PageHeader } from "@/components/layout/page-header";
import { pageTitle } from "@/lib/product-brand";

export const metadata = { title: pageTitle("Members") };

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
        <PageHeader title="Members" />
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
        <PageHeader title="Members" />
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
        <PageHeader title="Members" />
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

  if (!orgResult.ok || !(orgResult.data as any)?.organization) {
    return (
      <div className="space-y-6 max-w-4xl">
        <PageHeader title="Members" />
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const membership = orgResult.data as any;
  const org = membership.organization;
  const subscription = org.subscription;
  const entitlement = getEntitlementState(subscription);
  const canManageMembers = hasPermission(membership.role, "org:members:manage");
  const canViewAudit = hasPermission(membership.role, "audit:view");

  const pendingInviteCount = await runOrgScopedQuery(orgRes, (orgId) =>
    prisma.auditLog.count({
      where: { organizationId: orgId, action: "member:invite_pending" },
    }),
  );
  const pendingInvites = pendingInviteCount.ok ? (pendingInviteCount.data as number) : 0;
  const recentAuditResult = canViewAudit
    ? await runOrgScopedQuery(orgRes, (orgId) =>
        prisma.auditLog.findMany({
          where: {
            organizationId: orgId,
            OR: [
              { action: { startsWith: "member:" } },
              { action: { startsWith: "review:" } },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, action: true, createdAt: true },
        }),
      )
    : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recentAudit = recentAuditResult && recentAuditResult.ok ? (recentAuditResult.data as any[]) : [];
  const seatsUsed = org.memberships.length + pendingInvites;
  const seatCap = subscription?.maxSeats ?? 1;
  const seatsAtOrOverCap = seatsUsed >= seatCap;

  if (!entitlement.hasPaidAccess) {
    return (
      <div className="space-y-6 max-w-4xl">
        <PageHeader title="Members" />
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
      <PageHeader
        title="Members"
        description="Manage team members and their roles in your organization."
      />

      <div className="card">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Seat usage</h2>
          <Link href="/docs/team-admin" className="text-xs font-medium text-brand-700 hover:underline">
            Team-admin guide
          </Link>
        </div>
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
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Admin audit visibility</h2>
          {canViewAudit ? (
            <Link href={`/api/org/${org.id}/audit-log?format=csv`} className="text-xs font-medium text-brand-700 hover:underline">
              Export CSV
            </Link>
          ) : null}
        </div>
        {canViewAudit ? (
          recentAudit.length > 0 ? (
            <ul className="space-y-2 text-sm text-slate-700">
              {recentAudit.map((event) => (
                <li key={event.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <span className="font-mono text-xs text-slate-600">{event.action}</span>
                  <span className="text-xs text-slate-500">{event.createdAt.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No recent member/review audit events.</p>
          )
        ) : (
          <p className="text-sm text-slate-500">Your role can manage members but cannot view audit exports.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Link href={`/api/org/${org.id}/audit-log`} className="text-sm font-medium text-brand-700 hover:underline">
            Open org audit-log API
          </Link>
          <Link href="/trust" className="text-sm font-medium text-brand-700 hover:underline">
            Trust posture
          </Link>
        </div>
      </div>
    </div>
  );
}
