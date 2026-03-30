import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import {
  resolveDashboardOrgMembership,
  runOrgScopedQuery,
} from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { hasPermission } from "@aros/config";

export const metadata = { title: "Sites - AROS" };

export default async function SitesPage() {
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  const canViewSystem = await prisma.membership
    .findMany({ where: { userId: user.id }, select: { role: true } })
    .then((rows) => rows.some((m) => hasPermission(m.role, "org:system:view")))
    .catch(() => false);

  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind === "platform_blocked") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Sites</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Sites require a working database"
          showSystemLink={canViewSystem}
        >
          <p>
            Site data cannot be loaded until core data services are healthy.
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "error") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Sites</h1>
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
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Sites</h1>
        <RouteReliabilityNotice
          variant="info"
          title="No organization membership"
        >
          <p>You need an organization to manage sites.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const sitesResult = await runOrgScopedQuery(orgRes, (orgId) =>
    prisma.site.findMany({
      where: { workspace: { organizationId: orgId } },
      include: {
        workspace: { select: { name: true } },
        _count: {
          select: {
            crawlRuns: true,
            pages: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  );

  if (!sitesResult.ok) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Sites</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Could not load sites"
          showSystemLink={canViewSystem}
        >
          <p>{sitesResult.message}</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const sites = sitesResult.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sites</h1>
          <p className="text-slate-500 mt-1">Manage your monitored websites</p>
        </div>
        <Link href="/sites/new" className="btn-primary">
          Add Site
        </Link>
      </div>

      {sites.length === 0 ? (
        <div className="card text-center py-12">
          <h3 className="text-lg font-medium text-slate-900">No sites yet</h3>
          <p className="text-slate-500 mt-2">
            Add your first website to start scanning for accessibility issues.
          </p>
          <Link href="/sites/new" className="btn-primary mt-4 inline-flex">
            Add Your First Site
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {sites.map((site) => (
            <Link
              key={site.id}
              href={`/sites/${site.id}`}
              className="card hover:shadow-md transition-shadow flex items-center justify-between"
              aria-label={`${site.name} - ${site.domain}`}
            >
              <div>
                <h3 className="font-semibold text-slate-900">{site.name}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{site.domain}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                  <span>{site.workspace.name}</span>
                  <EnvironmentBadge environment={site.environment} />
                </div>
              </div>
              <div className="text-right text-sm text-slate-500">
                <p>{site._count.pages} pages</p>
                <p>{site._count.crawlRuns} crawls</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EnvironmentBadge({ environment }: { environment: string }) {
  const config: Record<string, { label: string; className: string }> = {
    PRODUCTION: {
      label: "Production",
      className: "bg-green-100 text-green-800",
    },
    STAGING: { label: "Staging", className: "bg-amber-100 text-amber-800" },
    DEVELOPMENT: {
      label: "Development",
      className: "bg-blue-100 text-blue-800",
    },
  };
  const { label, className } = config[environment] ?? {
    label: environment,
    className: "bg-slate-100 text-slate-600",
  };
  return <span className={`badge text-xs ${className}`}>{label}</span>;
}
