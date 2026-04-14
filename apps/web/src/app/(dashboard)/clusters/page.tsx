import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { Layers, ArrowRight } from 'lucide-react';
import { getRoutePlatformTruth } from '@/lib/platform-truth-cache';
import { resolveDashboardOrgMembership, runOrgScopedQuery } from '@/lib/route-data-boundary';
import { RouteReliabilityNotice } from '@/components/reliability/route-reliability-notice';
import { hasPermission } from '@aros/config';
import { EmptyState } from '@aros/ui';
import { PageHeader } from '@/components/layout/page-header';
import { pageTitle } from '@/lib/product-brand';

export const metadata = { title: pageTitle('Issue Clusters') };

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

const severityBorder: Record<string, string> = {
  CRITICAL: 'border-l-red-500',
  SERIOUS:  'border-l-orange-500',
  MODERATE: 'border-l-amber-400',
  MINOR:    'border-l-slate-300',
};

const severityBadge: Record<string, string> = {
  CRITICAL: 'badge-critical',
  SERIOUS:  'badge-serious',
  MODERATE: 'badge-moderate',
  MINOR:    'badge-minor',
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
        <PageHeader title="Issue clusters" />
        <RouteReliabilityNotice variant="error" title="Clusters require a working database" showSystemLink={canViewSystem}>
          <p>Cluster data cannot be loaded until core data services are healthy.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === 'error') {
    return (
      <div className="space-y-6">
        <PageHeader title="Issue clusters" />
        <RouteReliabilityNotice variant="error" title="Could not verify organization" showSystemLink={canViewSystem}>
          <p>{orgRes.message}</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === 'none') {
    return (
      <div className="space-y-6">
        <PageHeader title="Issue clusters" />
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
        <PageHeader title="Issue clusters" />
        <RouteReliabilityNotice variant="error" title="Could not load clusters" showSystemLink={canViewSystem}>
          <p>{clustersResult.message}</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const clusters = clustersResult.data as ClusterListItem[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Issue clusters"
        description="Grouped accessibility issues by component pattern. Fix once, resolve everywhere."
      />

      {clusters.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No issue clusters yet"
          description="Clusters group related findings by component or selector pattern. Fix a cluster once and resolve the same issue across every affected page — higher leverage than individual fixes."
          action={
            <Link href="/sites" className="btn-primary">
              Run a scan to discover patterns
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {clusters.map((cluster: ClusterListItem) => (
            <Link
              key={cluster.id}
              href={`/clusters/${cluster.id}`}
              className={`group flex items-start justify-between gap-4 overflow-hidden rounded-xl border border-l-4 border-slate-200 bg-white p-4 shadow-[0_1px_2px_0_rgb(15_23_42/0.04)] transition-shadow hover:shadow-md ${severityBorder[cluster.severity] ?? 'border-l-slate-300'}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`badge ${severityBadge[cluster.severity] ?? 'badge-minor'}`}>
                    {cluster.severity.toLowerCase()}
                  </span>
                  <span className="text-xs text-slate-400">{cluster.site.name}</span>
                  {cluster._count.suggestions > 0 && (
                    <span className="badge bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200">
                      {cluster._count.suggestions} fix{cluster._count.suggestions !== 1 ? 'es' : ''}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-700 transition-colors">
                  {cluster.name}
                </p>
                {cluster.description && (
                  <p className="mt-1 text-xs text-slate-500 line-clamp-1">{cluster.description}</p>
                )}
                {cluster.selectorPattern && (
                  <code className="mt-1.5 block w-fit rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                    {cluster.selectorPattern}
                  </code>
                )}
              </div>
              <div className="shrink-0 text-right text-sm">
                <p className="font-semibold tabular-nums text-slate-900">{cluster.pageCount} pages</p>
                <p className="text-xs text-slate-500">{cluster._count.findings} findings</p>
                <ArrowRight className="ml-auto mt-2 h-4 w-4 text-slate-300 group-hover:text-brand-500 transition-colors" aria-hidden="true" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
