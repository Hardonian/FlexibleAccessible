import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import {
  resolveDashboardOrgMembership,
  runOrgScopedQuery,
} from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { EntitlementWall } from "@/components/monetization/entitlement-wall";
import { getEntitlementState } from "@/lib/auth-guard";
import { hasPermission } from "@aros/config";

export const metadata = { title: "Settings - AROS" };

export default async function SettingsPage() {
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
    // Log error but don't fail the page
    console.warn("[settings page] Failed to check system permissions", {
      userId: user.id,
      error,
    });
  }

  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind === "platform_blocked") {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Settings require a working database"
          showSystemLink={canViewSystem}
        >
          <p>
            Organization settings cannot be loaded until core data services are
            healthy.
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "error") {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
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
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <RouteReliabilityNotice
          variant="info"
          title="No organization membership"
        >
          <p>You need an organization to view settings.</p>
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
                user: { select: { id: true, name: true, email: true } },
              },
              orderBy: { createdAt: "asc" },
            },
            integrationConnections: true,
          },
        },
      },
    }),
  );

  if (!orgResult.ok || !orgResult.data?.organization) {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
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

  if (!entitlement.hasPaidAccess) {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <EntitlementWall
          subscription={subscription}
          entitlement={entitlement}
          title="Billing and recovery"
          description="Billing stays available so you can upgrade or restore service, but the broader private settings workspace stays locked until the organization has an active paid subscription."
        />
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">
            Organization
          </h2>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Name</dt>
              <dd className="font-medium text-slate-900">{org.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Slug</dt>
              <dd className="font-mono text-slate-900">{org.slug}</dd>
            </div>
          </dl>
          <div className="mt-4">
            <Link href="/settings/billing" className="btn-primary">
              Open billing
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-slate-900">Settings</h1>

      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Organization
        </h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-slate-500">Name</dt>
            <dd className="text-sm font-medium text-slate-900">{org.name}</dd>
          </div>
          <div>
            <dt className="text-sm text-slate-500">Slug</dt>
            <dd className="text-sm font-mono text-slate-900">{org.slug}</dd>
          </div>
        </dl>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Plan & Billing
        </h2>
        {subscription ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">
                  {subscription.plan} Plan
                  {subscription.aiEnabled && (
                    <span className="ml-2 badge bg-brand-100 text-brand-700">
                      AI Pro Included
                    </span>
                  )}
                </p>
                <p className="text-sm text-slate-500">
                  Status: {subscription.status.toLowerCase()}
                </p>
              </div>
              <Link href="/settings/billing" className="btn-secondary text-xs">
                Billing details
              </Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-slate-200">
              <div>
                <p className="text-xs text-slate-500">Domains</p>
                <p className="text-sm font-medium">{subscription.maxDomains}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Pages/Crawl</p>
                <p className="text-sm font-medium">
                  {subscription.maxPagesPerCrawl}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Scans/Month</p>
                <p className="text-sm font-medium">
                  {subscription.maxScansPerMonth}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Seats</p>
                <p className="text-sm font-medium">{subscription.maxSeats}</p>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-slate-500">No active subscription.</p>
        )}
      </div>

      {subscription?.aiEnabled && (
        <div className="card border-brand-200 bg-gradient-to-br from-white to-brand-50/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              AI Insights & Efficiency
            </h2>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-slate-500">
                Connected to AROS AI Mesh
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-xl border border-slate-100 bg-white shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase">
                Tokens Consumed
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {(
                  (
                    await prisma.aiUsageLog.aggregate({
                      where: { organizationId: org.id },
                      _sum: { totalTokens: true },
                    })
                  )._sum.totalTokens ?? 0
                ).toLocaleString()}
              </p>
              <div className="mt-2 text-[10px] text-slate-400">
                Limit: {subscription.aiTokenLimit.toLocaleString()}
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-white shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase">
                AI Suggestions
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {await prisma.aiUsageLog.count({
                  where: { organizationId: org.id },
                })}
              </p>
              <div className="mt-2 text-[10px] text-slate-400">
                Automated fixes generated
              </div>
            </div>

            <div className="p-4 rounded-xl border border-brand-100 bg-brand-50/50 shadow-sm border-dashed">
              <p className="text-xs font-medium text-brand-700 uppercase">
                Value Generated
              </p>
              <p className="mt-1 text-2xl font-bold text-brand-900">
                $
                {(
                  (
                    await prisma.aiUsageLog.aggregate({
                      where: { organizationId: org.id },
                      _sum: { cost: true },
                    })
                  )._sum.cost ?? 0
                ).toFixed(2)}
              </p>
              <div className="mt-2 text-[10px] text-brand-600">
                Cost reduction estimate
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Team Members</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th
                  scope="col"
                  className="pb-2 text-left font-medium text-slate-500"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="pb-2 text-left font-medium text-slate-500"
                >
                  Email
                </th>
                <th
                  scope="col"
                  className="pb-2 text-left font-medium text-slate-500"
                >
                  Role
                </th>
              </tr>
            </thead>
            <tbody>
              {org.memberships.map((m) => (
                <tr key={m.id} className="border-b border-slate-100">
                  <td className="py-2 font-medium text-slate-900">
                    {m.user.name ?? "Unnamed"}
                  </td>
                  <td className="py-2 text-slate-600">{m.user.email}</td>
                  <td className="py-2">
                    <span className="badge bg-slate-100 text-slate-700">
                      {m.role.toLowerCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
        </div>
        {org.integrationConnections.length === 0 ? (
          <p className="text-sm text-slate-500">No integrations connected.</p>
        ) : (
          <ul className="space-y-2" role="list">
            {org.integrationConnections.map((conn) => (
              <li
                key={conn.id}
                className="flex items-center justify-between py-2 border-b border-slate-100"
              >
                <div>
                  <span className="badge bg-slate-100 text-slate-700 mr-2">
                    {conn.type.toLowerCase()}
                  </span>
                  <span className="text-sm text-slate-900">{conn.name}</span>
                </div>
                <span
                  className={`badge ${conn.isActive ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-500"}`}
                >
                  {conn.isActive ? "active" : "inactive"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
