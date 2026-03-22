import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { startCrawlAction } from './actions';

export async function generateMetadata({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { name: true } });
  return { title: site ? `${site.name} - AROS` : 'Site - AROS' };
}

export default async function SiteDetailPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const user = await requireSession();

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      workspace: {
        include: {
          organization: {
            include: {
              memberships: { where: { userId: user.id }, take: 1 },
            },
          },
        },
      },
      crawlConfig: true,
      _count: { select: { pages: true, crawlRuns: true, scanRuns: true } },
    },
  });

  if (!site || site.workspace.organization.memberships.length === 0) {
    notFound();
  }

  const [recentCrawls, recentScans, findings] = await Promise.all([
    prisma.crawlRun.findMany({
      where: { siteId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.scanRun.findMany({
      where: { siteId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.canonicalFinding.findMany({
      where: {
        occurrences: { some: { page: { siteId } } },
        status: 'OPEN',
      },
      orderBy: { impact: 'asc' },
      take: 20,
    }),
  ]);

  const findingsBySeverity = {
    critical: findings.filter((f) => f.impact === 'CRITICAL').length,
    serious: findings.filter((f) => f.impact === 'SERIOUS').length,
    moderate: findings.filter((f) => f.impact === 'MODERATE').length,
    minor: findings.filter((f) => f.impact === 'MINOR').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/sites" className="hover:text-brand-600">
              Sites
            </Link>
            <span>/</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{site.name}</h1>
          <p className="text-slate-500 mt-0.5">{site.domain}</p>
        </div>
        <div className="flex gap-3">
          <form action={startCrawlAction}>
            <input type="hidden" name="siteId" value={siteId} />
            <button type="submit" className="btn-primary">
              Start Crawl
            </button>
          </form>
          <Link href={`/sites/${siteId}/settings`} className="btn-secondary">
            Settings
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-slate-500">Pages Discovered</p>
          <p className="text-2xl font-bold text-slate-900">{site._count.pages}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Total Crawls</p>
          <p className="text-2xl font-bold text-slate-900">{site._count.crawlRuns}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Total Scans</p>
          <p className="text-2xl font-bold text-slate-900">{site._count.scanRuns}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Open Findings</p>
          <p className="text-2xl font-bold text-slate-900">{findings.length}</p>
        </div>
      </div>

      {/* Severity Breakdown */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Findings by Severity</h2>
        <div className="flex gap-6">
          <SeverityBlock label="Critical" count={findingsBySeverity.critical} color="red" />
          <SeverityBlock label="Serious" count={findingsBySeverity.serious} color="orange" />
          <SeverityBlock label="Moderate" count={findingsBySeverity.moderate} color="amber" />
          <SeverityBlock label="Minor" count={findingsBySeverity.minor} color="green" />
        </div>
      </div>

      {/* Recent Crawls */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Crawls</h2>
        {recentCrawls.length === 0 ? (
          <p className="text-sm text-slate-500">No crawls yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="pb-2 text-left font-medium text-slate-500">Status</th>
                  <th className="pb-2 text-right font-medium text-slate-500">Pages</th>
                  <th className="pb-2 text-right font-medium text-slate-500">Started</th>
                  <th className="pb-2 text-right font-medium text-slate-500">Completed</th>
                </tr>
              </thead>
              <tbody>
                {recentCrawls.map((crawl) => (
                  <tr key={crawl.id} className="border-b border-slate-100">
                    <td className="py-2">
                      <span
                        className={`badge ${
                          crawl.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : crawl.status === 'RUNNING'
                            ? 'bg-blue-100 text-blue-800'
                            : crawl.status === 'FAILED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {crawl.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="py-2 text-right text-slate-600">
                      {crawl.pagesCrawled}
                    </td>
                    <td className="py-2 text-right text-slate-500">
                      {crawl.startedAt?.toLocaleString() ?? '-'}
                    </td>
                    <td className="py-2 text-right text-slate-500">
                      {crawl.completedAt?.toLocaleString() ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Scans */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Scans</h2>
        {recentScans.length === 0 ? (
          <p className="text-sm text-slate-500">No scans yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="pb-2 text-left font-medium text-slate-500">Status</th>
                  <th className="pb-2 text-right font-medium text-slate-500">Pages scanned</th>
                  <th className="pb-2 text-right font-medium text-slate-500">Violations</th>
                  <th className="pb-2 text-right font-medium text-slate-500">Started</th>
                </tr>
              </thead>
              <tbody>
                {recentScans.map((scan) => (
                  <tr key={scan.id} className="border-b border-slate-100">
                    <td className="py-2">
                      <span
                        className={`badge ${
                          scan.status === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : scan.status === 'RUNNING'
                            ? 'bg-blue-100 text-blue-800'
                            : scan.status === 'FAILED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {scan.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="py-2 text-right text-slate-600">
                      {scan.pagesScanned}
                      {scan.totalPages > 0 ? ` / ${scan.totalPages}` : ''}
                    </td>
                    <td className="py-2 text-right text-slate-600">{scan.violationsFound}</td>
                    <td className="py-2 text-right text-slate-500">
                      {scan.startedAt?.toLocaleString() ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Open Findings */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Open Findings
          <Link href={`/findings?siteId=${siteId}`} className="text-sm font-normal text-brand-600 ml-3">
            View all
          </Link>
        </h2>
        {findings.length === 0 ? (
          <p className="text-sm text-slate-500">No open findings. Run a scan to discover issues.</p>
        ) : (
          <ul className="space-y-2" role="list">
            {findings.slice(0, 10).map((finding) => (
              <li key={finding.id} className="flex items-center justify-between py-2 border-b border-slate-100">
                <div>
                  <span
                    className={`badge mr-2 ${
                      finding.impact === 'CRITICAL'
                        ? 'badge-critical'
                        : finding.impact === 'SERIOUS'
                        ? 'badge-serious'
                        : finding.impact === 'MODERATE'
                        ? 'badge-moderate'
                        : 'badge-minor'
                    }`}
                  >
                    {finding.impact.toLowerCase()}
                  </span>
                  <span className="text-sm text-slate-900">{finding.description}</span>
                </div>
                <span className="text-xs text-slate-500">
                  {finding.occurrenceCount} occurrences
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SeverityBlock({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    red: 'text-red-600',
    orange: 'text-orange-600',
    amber: 'text-amber-600',
    green: 'text-green-600',
  };
  return (
    <div>
      <p className={`text-2xl font-bold ${colorMap[color]}`}>{count}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
