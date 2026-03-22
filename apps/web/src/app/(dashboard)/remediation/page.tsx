import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import Link from 'next/link';

export const metadata = { title: 'Remediation - AROS' };

export default async function RemediationPage() {
  const user = await requireSession();

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
  });
  if (!membership) return null;

  const suggestions = await prisma.remediationSuggestion.findMany({
    where: {
      OR: [
        {
          finding: {
            occurrences: {
              some: { page: { site: { workspace: { organizationId: membership.organizationId } } } },
            },
          },
        },
        {
          cluster: { site: { workspace: { organizationId: membership.organizationId } } },
        },
      ],
    },
    orderBy: [{ status: 'asc' }, { confidence: 'desc' }],
    include: {
      finding: { select: { description: true, ruleId: true, impact: true } },
      cluster: { select: { name: true } },
    },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Remediation Suggestions</h1>
        <p className="text-slate-500 mt-1">
          AI-generated fix suggestions. Review before applying.
        </p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
        All suggestions are AI-generated drafts. They must be reviewed by a human before export or application.
        Automated scanning cannot guarantee full WCAG conformance.
      </div>

      {suggestions.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-500">No remediation suggestions yet. Run scans to generate them.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s) => (
            <Link
              key={s.id}
              href={`/remediation/${s.id}`}
              className="card hover:shadow-md transition-shadow block"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge bg-blue-100 text-blue-800">
                      {s.type.toLowerCase().replace('_', ' ')}
                    </span>
                    <StatusBadge status={s.status} />
                    {s.cluster && (
                      <span className="text-xs text-purple-600">{s.cluster.name}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-900">
                    {s.finding?.description ?? s.rationale.slice(0, 100)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{s.rationale}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">
                    {Math.round(s.confidence * 100)}%
                  </p>
                  <p className="text-xs text-slate-500">confidence</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-slate-100 text-slate-600',
    VALIDATED: 'bg-green-100 text-green-800',
    FAILED_VALIDATION: 'bg-red-100 text-red-800',
    APPROVED: 'bg-blue-100 text-blue-800',
    EXPORTED: 'bg-purple-100 text-purple-800',
    APPLIED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`badge ${styles[status] ?? ''}`}>
      {status.toLowerCase().replace('_', ' ')}
    </span>
  );
}
