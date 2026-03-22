import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import Link from 'next/link';

export const metadata = { title: 'Issue Clusters - AROS' };

export default async function ClustersPage() {
  const user = await requireSession();

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
  });
  if (!membership) return null;

  const clusters = await prisma.issueCluster.findMany({
    where: { site: { workspace: { organizationId: membership.organizationId } } },
    orderBy: [{ severity: 'asc' }, { findingCount: 'desc' }],
    include: {
      site: { select: { name: true, domain: true } },
      _count: { select: { findings: true, suggestions: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Issue Clusters</h1>
        <p className="text-slate-500 mt-1">
          Grouped accessibility issues by component pattern. Fix once, resolve everywhere.
        </p>
      </div>

      {clusters.length === 0 ? (
        <div className="card text-center py-12">
          <h3 className="text-lg font-medium text-slate-900">No clusters yet</h3>
          <p className="text-slate-500 mt-2">
            Clusters are generated after scanning. Run a scan to discover component-level patterns.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {clusters.map((cluster) => (
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
                  {cluster.description && (
                    <p className="text-sm text-slate-500 mt-1">{cluster.description}</p>
                  )}
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
