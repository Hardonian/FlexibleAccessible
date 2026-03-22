import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import Link from 'next/link';

export const metadata = { title: 'Dashboard - AROS' };

export default async function DashboardPage() {
  const user = await requireSession();

  let membership: {
    organizationId: string;
    organization: { id: string; name: string; slug: string };
  } | null = null;
  let dataError: string | null = null;

  try {
    membership = await prisma.membership.findFirst({
      where: { userId: user.id },
      include: { organization: true },
    });
  } catch (e) {
    dataError = e instanceof Error ? e.message : 'Database error';
    console.error('[dashboard] membership load failed', e);
  }

  if (!membership) {
    return (
      <div className="space-y-6">
        {dataError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status">
            <p className="font-medium">Data temporarily unavailable</p>
            <p className="mt-1">
              The dashboard could not load your organization. Check database connectivity and migrations.{' '}
              {dataError && <span className="block mt-1 text-amber-900/90">Detail: {dataError}</span>}
            </p>
            <p className="mt-2">
              Operators: see <Link href="/system" className="text-brand-700 underline">System &amp; core services</Link>{' '}
              (requires admin/owner).
            </p>
          </div>
        )}
        <div className="text-center py-12">
          <h2 className="text-lg font-semibold text-slate-900">No organization found</h2>
          <p className="text-slate-500 mt-2">Please contact support.</p>
        </div>
      </div>
    );
  }

  const orgId = membership.organizationId;

  let sitesCount = 0;
  let openFindings = 0;
  let clustersCount = 0;
  let pendingReviews = 0;
  let recentCrawls: Array<{
    id: string;
    status: string;
    pagesCrawled: number;
    pagesFound: number;
    createdAt: Date;
    site: { name: string; domain: string };
  }> = [];

  try {
    [sitesCount, openFindings, clustersCount, pendingReviews, recentCrawls] = await Promise.all([
      prisma.site.count({
        where: { workspace: { organizationId: orgId } },
      }),
      prisma.canonicalFinding.count({
        where: {
          status: 'OPEN',
          occurrences: {
            some: { page: { site: { workspace: { organizationId: orgId } } } },
          },
        },
      }),
      prisma.issueCluster.count({
        where: { site: { workspace: { organizationId: orgId } } },
      }),
      prisma.reviewTask.count({
        where: { status: 'PENDING' },
      }),
      prisma.crawlRun.findMany({
        where: { site: { workspace: { organizationId: orgId } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { site: { select: { name: true, domain: true } } },
      }),
    ]);
  } catch (e) {
    dataError = e instanceof Error ? e.message : 'Database error';
    console.error('[dashboard] stats load failed', e);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">
          Overview for {membership.organization.name}
        </p>
      </div>

      {dataError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status">
          <p className="font-medium">Partial data</p>
          <p className="mt-1">
            Some dashboard metrics could not be loaded. Counts below may be zero until the database is healthy.{' '}
            <span className="block mt-1 text-amber-900/90">Detail: {dataError}</span>
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sites" value={sitesCount} href="/sites" />
        <StatCard label="Open Findings" value={openFindings} href="/findings" />
        <StatCard label="Issue Clusters" value={clustersCount} href="/clusters" />
        <StatCard label="Pending Reviews" value={pendingReviews} href="/reviews" />
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/sites/new" className="btn-primary">
            Add Site
          </Link>
          <Link href="/findings" className="btn-secondary">
            View Findings
          </Link>
          <Link href="/reports" className="btn-secondary">
            Generate Report
          </Link>
        </div>
      </div>

      {/* Recent Crawls */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Crawls</h2>
        {recentCrawls.length === 0 ? (
          <p className="text-slate-500 text-sm">
            No crawls yet.{' '}
            <Link href="/sites/new" className="text-brand-600 hover:text-brand-700">
              Add a site
            </Link>{' '}
            to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="pb-2 text-left font-medium text-slate-500">Site</th>
                  <th className="pb-2 text-left font-medium text-slate-500">Status</th>
                  <th className="pb-2 text-right font-medium text-slate-500">Pages</th>
                  <th className="pb-2 text-right font-medium text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentCrawls.map((crawl) => (
                  <tr key={crawl.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-900">
                      {crawl.site.name}
                    </td>
                    <td className="py-2">
                      <CrawlStatusBadge status={crawl.status} />
                    </td>
                    <td className="py-2 text-right text-slate-600">
                      {crawl.pagesCrawled}/{crawl.pagesFound}
                    </td>
                    <td className="py-2 text-right text-slate-500">
                      {crawl.createdAt.toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link href={href} className="card hover:shadow-md transition-shadow group">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
        {value.toLocaleString()}
      </p>
    </Link>
  );
}

function CrawlStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    COMPLETED: 'bg-green-100 text-green-800',
    RUNNING: 'bg-blue-100 text-blue-800',
    PENDING: 'bg-slate-100 text-slate-800',
    FAILED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`badge ${styles[status] ?? 'bg-slate-100 text-slate-800'}`}>
      {status.toLowerCase()}
    </span>
  );
}
