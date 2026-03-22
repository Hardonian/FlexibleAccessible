import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { FindingStatusForm } from './finding-status-form';

export default async function FindingDetailPage({
  params,
}: {
  params: Promise<{ findingId: string }>;
}) {
  const { findingId } = await params;
  await requireSession();

  const finding = await prisma.canonicalFinding.findUnique({
    where: { id: findingId },
    include: {
      occurrences: {
        include: { page: { select: { id: true, url: true, title: true } } },
        take: 50,
        orderBy: { lastSeenAt: 'desc' },
      },
      cluster: true,
      suggestions: {
        orderBy: { confidence: 'desc' },
        take: 5,
      },
    },
  });

  if (!finding) notFound();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <Link href="/findings" className="hover:text-brand-600">Findings</Link>
          <span>/</span>
        </div>
        <div className="flex items-center gap-3">
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
          <h1 className="text-2xl font-bold text-slate-900">{finding.description}</h1>
        </div>
      </div>

      {/* Metadata */}
      <div className="card grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Rule</p>
          <p className="text-sm font-medium text-slate-900 mt-1">{finding.ruleId}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">WCAG</p>
          <p className="text-sm font-medium text-slate-900 mt-1">
            {finding.wcagTags.join(', ') || 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Occurrences</p>
          <p className="text-sm font-medium text-slate-900 mt-1">{finding.occurrenceCount}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Status</p>
          <FindingStatusForm findingId={findingId} defaultValue={finding.status} />
        </div>
      </div>

      {finding.helpUrl && (
        <div className="card">
          <p className="text-sm text-slate-600">
            <a href={finding.helpUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
              Learn more about this rule
            </a>
          </p>
        </div>
      )}

      {/* Cluster Info */}
      {finding.cluster && (
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Component Cluster</h2>
          <Link
            href={`/clusters/${finding.cluster.id}`}
            className="text-brand-600 hover:text-brand-700 font-medium"
          >
            {finding.cluster.name}
          </Link>
          <p className="text-sm text-slate-500 mt-1">{finding.cluster.description}</p>
        </div>
      )}

      {/* Remediation Suggestions */}
      {finding.suggestions.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Remediation Suggestions</h2>
          <div className="space-y-4">
            {finding.suggestions.map((suggestion) => (
              <div key={suggestion.id} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="badge bg-blue-100 text-blue-800">{suggestion.type.toLowerCase().replace('_', ' ')}</span>
                  <span className="text-sm text-slate-500">
                    Confidence: {Math.round(suggestion.confidence * 100)}%
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-3">{suggestion.rationale}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Original</p>
                    <pre className="bg-red-50 border border-red-200 rounded p-2 text-xs overflow-x-auto">
                      <code>{suggestion.originalCode}</code>
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Suggested Fix</p>
                    <pre className="bg-green-50 border border-green-200 rounded p-2 text-xs overflow-x-auto">
                      <code>{suggestion.suggestedCode}</code>
                    </pre>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/remediation/${suggestion.id}`}
                    className="btn-secondary text-xs"
                  >
                    Review & Export
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Occurrences */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Affected Pages ({finding.occurrences.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pb-2 text-left font-medium text-slate-500">Page</th>
                <th className="pb-2 text-left font-medium text-slate-500">Selector</th>
                <th className="pb-2 text-right font-medium text-slate-500">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {finding.occurrences.map((occ) => (
                <tr key={occ.id} className="border-b border-slate-100">
                  <td className="py-2">
                    <p className="font-medium text-slate-900">{occ.page.title ?? occ.page.url}</p>
                    <p className="text-xs text-slate-400">{occ.page.url}</p>
                  </td>
                  <td className="py-2">
                    <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                      {occ.selector.length > 60 ? occ.selector.slice(0, 60) + '...' : occ.selector}
                    </code>
                  </td>
                  <td className="py-2 text-right text-slate-500">
                    {occ.lastSeenAt.toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
