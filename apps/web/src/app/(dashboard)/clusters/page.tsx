import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { getRoutePlatformTruth } from '@/lib/platform-truth-cache';
import { resolveDashboardOrgMembership, runOrgScopedQuery } from '@/lib/route-data-boundary';
import { RouteReliabilityNotice } from '@/components/reliability/route-reliability-notice';
import { hasPermission } from '@aros/config';
import { getParetoAnalysis } from '@/lib/impact/compute-cluster-impact';
import { ParetoImpactCard } from '@/components/clusters/pareto-impact-card';

export const metadata = { title: 'Issue Clusters' };


type ClusterListItem = {
  id: string;
  severity: 'CRITICAL' | 'SERIOUS' | 'MODERATE' | 'MINOR';
  name: string;
  description: string | null;
  selectorPattern: string | null;
  pageCount: number;
  site: { name: string; domain: string };
  _count: { findings: number; suggestions: number };
};

export default async function ClustersPage() {
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  let canViewSystem = false;
  try {
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      select: { role: true },
    });
    for (const membership of memberships) {
      if (hasPermission(membership.role, 'org:system:view')) {
        canViewSystem = true;
        break;
      }
    }
  } catch {
    canViewSystem = false;
  }

  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind === 'platform_blocked') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Issue Clusters</h1>
        <RouteReliabilityNotice variant="error" title="Clusters require a working database" showSystemLink={canViewSystem}>
          <p>Cluster data cannot be loaded until core data services are healthy.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === 'error') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Issue Clusters</h1>
        <RouteReliabilityNotice variant="error" title="Could not verify organization" showSystemLink={canViewSystem}>
          <p>{orgRes.message}</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === 'none') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Issue Clusters</h1>
        <RouteReliabilityNotice variant="info" title="No organization membership">
          <p>You need an organization to view clusters.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const clustersResult = await runOrgScopedQuery(orgRes, (orgId) =>
    prisma.issueCluster.findMany({
      where: { site: { workspace: { organizationId: orgId } } },
      orderBy: [{ severity: 'asc' }, { findingCount: 'desc' }],
      include: {
        site: { select: { name: true, domain: true } },
        _count: { select: { findings: true, suggestions: true } },
      },
    })
  );

  if (!clustersResult.ok) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Issue Clusters</h1>
        <RouteReliabilityNotice variant="error" title="Could not load clusters" showSystemLink={canViewSystem}>
          <p>{clustersResult.message}</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const clusters = clustersResult.data as (ClusterListItem & { siteId?: string })[];

  let paretoAnalysis = { clusters: [] as any[], totalImpact: 0, paretoCut: 0 };
  const firstSiteId = clusters[0]?.siteId;
  if (firstSiteId) {
    try {
      paretoAnalysis = (await getParetoAnalysis(firstSiteId)) as any;
    } catch {
      // Degraded or no data
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Issue Clusters</h1>
        <p className="text-slate-500 mt-1">
          Grouped accessibility issues by component pattern. Fix once, resolve everywhere.
        </p>
      </div>

      {paretoAnalysis.clusters.length > 0 && (
        <ParetoImpactCard analysis={paretoAnalysis} />
      )}

      {clusters.length === 0 ? (
        <div className="card py-10 px-6">
          <div className="mx-auto max-w-md text-center">
            <h3 className="text-base font-semibold text-slate-900">No issue clusters yet</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Issue clusters group related findings by component or selector pattern.
              Fix a cluster once and resolve the same issue across every affected page —
              higher leverage than fixing individual occurrences.
            </p>
            <Link href="/sites" className="btn-primary mt-6 inline-block text-sm">
              Run a scan to discover patterns
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {clusters.map((cluster: ClusterListItem) => (
            <Link
              key={cluster.id}
              href={`/clusters/${cluster.id}`}
              className="card hover:shadow-md transition-shadow block"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`badge ${
                        cluster.severity === 'CRITICAL'
                          ? 'badge-critical'
                          : cluster.severity === 'SERIOUS'
                            ? 'badge-serious'
                            : cluster.severity === 'MODERATE'
                              ? 'badge-moderate'
                              : 'badge-minor'
                      }`}
                    >
                      {cluster.severity.toLowerCase()}
                    </span>
                    <span className="text-xs text-slate-400">{cluster.site.name}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">{cluster.name}</h3>
                  {cluster.description && <p className="text-sm text-slate-500 mt-1">{cluster.description}</p>}
                  {cluster.selectorPattern && (
                    <code className="mt-2 block text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">
                      {cluster.selectorPattern}
                    </code>
                  )}
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold text-slate-900">{cluster.pageCount} pages</p>
                  <p className="text-slate-500">{cluster._count.findings} findings</p>
                  {cluster._count.suggestions > 0 && (
                    <p className="text-brand-600">{cluster._count.suggestions} suggestions</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
