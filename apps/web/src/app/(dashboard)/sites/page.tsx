import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Globe } from "lucide-react";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import {
  resolveDashboardOrgMembership,
  runOrgScopedQuery,
} from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { hasPermission } from "@aros/config";
import { EmptyState } from "@aros/ui";
import { PageHeader } from "@/components/layout/page-header";
import { pageTitle } from "@/lib/product-brand";

export const metadata = { title: pageTitle("Sites") };

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
      <PageHeader
        title="Sites"
        description="Targets you crawl and verify. Add production and staging separately when they differ."
      >
        <Link href="/sites/new" className="btn-primary w-full sm:w-auto">
          Add site
        </Link>
      </PageHeader>

      {sites.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No sites yet"
          description="Add your first website to start scanning for accessibility issues."
          action={
            <Link href="/sites/new" className="btn-primary">
              Add Your First Site
            </Link>
          }
          className="card"
        />
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
      className: "bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-200",
    },
    STAGING: {
      label: "Staging",
      className: "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200",
    },
    DEVELOPMENT: {
      label: "Development",
      className: "bg-sky-50 text-sky-900 ring-1 ring-inset ring-sky-200",
    },
  };
  const { label, className } = config[environment] ?? {
    label: environment,
    className: "bg-slate-100 text-slate-600",
  };
  return <span className={`badge text-xs ${className}`}>{label}</span>;
}
