import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import {
  resolveDashboardOrgMembership,
  runOrgScopedQuery,
} from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { hasPermission } from "@aros/config";

export const metadata = { title: "Settings - AROS" };

export default async function SettingsPage() {
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  const canViewSystem = await prisma.membership
    .findMany({ where: { userId: user.id }, select: { role: true } })
    .then((rows) => rows.some((m) => hasPermission(m.role, "org:system:view")))
    .catch(() => false);

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
                </p>
                <p className="text-sm text-slate-500">
                  Status: {subscription.status.toLowerCase()}
                </p>
              </div>
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
