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

import { pageTitle } from "@/lib/product-brand";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: pageTitle("Settings") };

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
        <PageHeader title="Settings" />
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
        <PageHeader title="Settings" />
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
        <PageHeader title="Settings" />
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
        <PageHeader title="Settings" />
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

  // Pre-fetch AI stats in parallel so the JSX has no inline awaits
  const aiStats = subscription?.aiEnabled
    ? await Promise.all([
        prisma.aiUsageLog.aggregate({ where: { organizationId: org.id }, _sum: { totalTokens: true } }),
        prisma.aiUsageLog.count({ where: { organizationId: org.id } }),
        prisma.aiUsageLog.aggregate({ where: { organizationId: org.id }, _sum: { cost: true } }),
      ]).then(([tokens, count, cost]) => ({
        totalTokens: tokens._sum.totalTokens ?? 0,
        count,
        totalCost: cost._sum.cost ?? 0,
      }))
    : null;

  if (!entitlement.hasPaidAccess) {
    return (
      <div className="space-y-6 max-w-4xl">
        <PageHeader title="Settings" />
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

      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Management
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link
            href="/settings/identity"
            className="group flex items-start gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/30"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-brand-100 group-hover:text-brand-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7zm8 3a3 3 0 100 6 3 3 0 000-6z" /></svg>
            </div>
            <div>
              <h3 className="font-medium text-slate-900 group-hover:text-brand-700">Identity & access</h3>
              <p className="mt-1 text-sm text-slate-500">Enterprise login policy, domains, and sign-in provenance</p>
            </div>
          </Link>

          <Link
            href="/settings/api-keys"
            className="group flex items-start gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/30"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-brand-100 group-hover:text-brand-600">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-slate-900 group-hover:text-brand-700">
                API Keys
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Scoped keys for automation and integrations
              </p>
            </div>
          </Link>

          <Link
            href="/settings/members"
            className="group flex items-start gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/30"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-brand-100 group-hover:text-brand-600">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-slate-900 group-hover:text-brand-700">
                Members
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Invite and manage team access
              </p>
            </div>
          </Link>

          <Link
            href="/settings/api-keys/usage"
            className="group flex items-start gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/30"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-brand-100 group-hover:text-brand-600">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-slate-900 group-hover:text-brand-700">
                API Usage
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Monitor usage and quotas
              </p>
            </div>
          </Link>

          <Link
            href="/trust"
            className="group flex items-start gap-3 rounded-xl border border-slate-200 p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/30"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-brand-100 group-hover:text-brand-600">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-slate-900 group-hover:text-brand-700">
                Trust &amp; admin
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Security posture, docs, and team-admin references
              </p>
            </div>
          </Link>
        </div>
      </div>

      {subscription?.aiEnabled && (
        <div className="card border-brand-200 bg-gradient-to-br from-white to-brand-50/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">
              AI draft assist (bounded)
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">
                Enabled for this organization · usage metered server-side
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-xl border border-slate-100 bg-white shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase">
                Tokens Consumed
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {aiStats!.totalTokens.toLocaleString()}
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
                {aiStats!.count.toLocaleString()}
              </p>
              <div className="mt-2 text-[10px] text-slate-400">
                Draft generations logged (review before ship)
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-100 bg-white shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase">
                Estimated provider cost
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                ${aiStats!.totalCost.toFixed(2)}
              </p>
              <div className="mt-2 text-[10px] text-slate-500">
                Internal meter only—not a savings or ROI claim
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
          <table className="data-table">
            <caption className="sr-only">Organization members</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
              </tr>
            </thead>
            <tbody>
              {org.memberships.map((m) => (
                <tr key={m.id}>
                  <td className="font-medium text-slate-900">
                    {m.user.name ?? "Unnamed"}
                  </td>
                  <td>{m.user.email}</td>
                  <td>
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
        <h2 className="text-lg font-semibold text-slate-900">Trust &amp; administration</h2>
        <p className="mt-1 text-sm text-slate-500">
          Procurement-facing trust posture, security limits, and team-admin operating guides.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/trust" className="btn-secondary text-xs">Trust center</Link>
          <Link href="/security" className="btn-secondary text-xs">Security posture</Link>
          <Link href="/docs/team-admin" className="btn-secondary text-xs">Team-admin docs</Link>
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
