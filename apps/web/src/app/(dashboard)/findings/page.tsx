import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import type { Prisma, Severity, FindingStatus } from '@aros/db';
import { getRoutePlatformTruth } from '@/lib/platform-truth-cache';
import { resolveDashboardOrgMembership, runOrgScopedQuery } from '@/lib/route-data-boundary';
import { RouteReliabilityNotice } from '@/components/reliability/route-reliability-notice';
import { hasPermission } from '@aros/config';

type FindingListRow = Prisma.CanonicalFindingGetPayload<{
  include: {
    _count: { select: { occurrences: true } };
    cluster: { select: { id: true; name: true } };
  };
}>;

export const metadata = { title: 'Findings - AROS' };

interface SearchParams {
  page?: string;
  severity?: string;
  status?: string;
  siteId?: string;
  ruleId?: string;
}

export default async function FindingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireSession();
  const params = await searchParams;
  const platformTruth = await getRoutePlatformTruth();
  const canViewSystem = await prisma.membership
    .findMany({ where: { userId: user.id }, select: { role: true } })
    .then((rows) => rows.some((m) => hasPermission(m.role, 'org:system:view')))
    .catch(() => false);

  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind === 'platform_blocked') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Findings</h1>
        <RouteReliabilityNotice variant="error" title="Findings require a working database" showSystemLink={canViewSystem}>
          <p>Findings cannot be loaded until core data services are healthy. See the banner above for status.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === 'error') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Findings</h1>
        <RouteReliabilityNotice variant="error" title="Could not verify organization" showSystemLink={canViewSystem}>
          <p>{orgRes.message}</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === 'none') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Findings</h1>
        <RouteReliabilityNotice variant="info" title="No organization membership">
          <p>You need to belong to an organization to view findings.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const page = parseInt(params.page ?? '1');
  const limit = 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    occurrences: {
      some: {
        page: {
          site: { workspace: { organizationId: orgRes.organizationId } },
          ...(params.siteId ? { siteId: params.siteId } : {}),
        },
      },
    },
  };

  if (params.severity) {
    where.impact = params.severity as Severity;
  }
  if (params.status) {
    where.status = params.status as FindingStatus;
  }
  if (params.ruleId) {
    where.ruleId = params.ruleId;
  }

  const listResult = await runOrgScopedQuery(orgRes, async () => {
    const [findings, total] = await Promise.all([
      prisma.canonicalFinding.findMany({
        where,
        orderBy: [{ impact: 'asc' }, { occurrenceCount: 'desc' }],
        skip,
        take: limit,
        include: {
          _count: { select: { occurrences: true } },
          cluster: { select: { id: true, name: true } },
        },
      }),
      prisma.canonicalFinding.count({ where }),
    ]);
    return { findings, total };
  });

  if (!listResult.ok) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Findings</h1>
        <RouteReliabilityNotice variant="error" title="Findings list unavailable" showSystemLink={canViewSystem}>
          <p>Could not load findings from the database ({listResult.message}).</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const { findings, total } = listResult.data;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Findings</h1>
          <p className="text-slate-500 mt-1">{total} accessibility issues found</p>
        </div>
      </div>

      <div className="card">
        <form className="flex flex-wrap gap-4" method="GET">
          <div>
            <label htmlFor="severity-filter" className="label">
              Severity
            </label>
            <select id="severity-filter" name="severity" className="input" defaultValue={params.severity ?? ''}>
              <option value="">All</option>
              <option value="CRITICAL">Critical</option>
              <option value="SERIOUS">Serious</option>
              <option value="MODERATE">Moderate</option>
              <option value="MINOR">Minor</option>
            </select>
          </div>
          <div>
            <label htmlFor="status-filter" className="label">
              Status
            </label>
            <select id="status-filter" name="status" className="input" defaultValue={params.status ?? ''}>
              <option value="">All</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="FIXED">Fixed</option>
              <option value="WONT_FIX">Won&apos;t Fix</option>
              <option value="FALSE_POSITIVE">False Positive</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-secondary">
              Filter
            </button>
          </div>
        </form>
      </div>

      {findings.length === 0 ? (
        <div className="card text-center py-12 space-y-2">
          <p className="text-slate-700 font-medium">No findings match your filters</p>
          <p className="text-sm text-slate-500">
            {total === 0
              ? 'There are no findings for this organization yet, or none match the selected filters.'
              : 'Try clearing filters or changing the page.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {findings.map((finding) => (
            <FindingRow key={finding.id} finding={finding} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
          {page > 1 && (
            <Link
              href={`/findings?page=${page - 1}&severity=${params.severity ?? ''}&status=${params.status ?? ''}`}
              className="btn-secondary text-sm"
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/findings?page=${page + 1}&severity=${params.severity ?? ''}&status=${params.status ?? ''}`}
              className="btn-secondary text-sm"
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

function FindingRow({ finding }: { finding: FindingListRow }) {
  return (
    <Link href={`/findings/${finding.id}`} className="card hover:shadow-md transition-shadow block">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`badge ${
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
            <span className="text-xs text-slate-400">{finding.ruleId}</span>
            {finding.cluster && (
              <span className="badge bg-purple-100 text-purple-800">{finding.cluster.name}</span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-900">{finding.description}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
            <span>{finding._count.occurrences} occurrences</span>
            <span>First seen: {finding.firstSeenAt.toLocaleDateString()}</span>
            {finding.wcagTags.length > 0 && <span>WCAG: {finding.wcagTags.join(', ')}</span>}
          </div>
        </div>
        <div>
          <StatusBadge status={finding.status} />
        </div>
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    OPEN: 'bg-red-100 text-red-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    FIXED: 'bg-green-100 text-green-800',
    WONT_FIX: 'bg-slate-100 text-slate-600',
    FALSE_POSITIVE: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`badge ${styles[status] ?? 'bg-slate-100 text-slate-800'}`}>
      {status.toLowerCase().replace('_', ' ')}
    </span>
  );
}
