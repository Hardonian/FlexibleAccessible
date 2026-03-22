import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { approveSuggestionAction, rejectSuggestionAction, exportSnippetAction } from './actions';

export default async function SuggestionDetailPage({
  params,
}: {
  params: Promise<{ suggestionId: string }>;
}) {
  const { suggestionId } = await params;
  await requireSession();

  const suggestion = await prisma.remediationSuggestion.findUnique({
    where: { id: suggestionId },
    include: {
      finding: {
        include: { _count: { select: { occurrences: true } } },
      },
      cluster: { select: { id: true, name: true, pageCount: true } },
      reviewTask: true,
    },
  });

  if (!suggestion) notFound();

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <Link href="/remediation" className="hover:text-brand-600">Remediation</Link>
          <span>/</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Remediation Suggestion</h1>
      </div>

      {/* Suggestion Header */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="badge bg-blue-100 text-blue-800">
              {suggestion.type.toLowerCase().replace('_', ' ')}
            </span>
            <span className={`badge ${
              suggestion.status === 'VALIDATED' ? 'bg-green-100 text-green-800' :
              suggestion.status === 'APPROVED' ? 'bg-blue-100 text-blue-800' :
              suggestion.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
              'bg-slate-100 text-slate-600'
            }`}>
              {suggestion.status.toLowerCase().replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Confidence: <strong>{Math.round(suggestion.confidence * 100)}%</strong>
          </p>
        </div>

        <h2 className="text-sm font-medium text-slate-500 mb-2">Rationale</h2>
        <p className="text-sm text-slate-700">{suggestion.rationale}</p>

        {suggestion.finding && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-500">Related finding:</p>
            <Link href={`/findings/${suggestion.finding.id}`} className="text-sm text-brand-600 hover:underline">
              {suggestion.finding.description}
            </Link>
            <span className="text-xs text-slate-400 ml-2">
              ({suggestion.finding._count.occurrences} occurrences)
            </span>
          </div>
        )}

        {suggestion.cluster && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            <p className="text-xs text-slate-500">Component cluster:</p>
            <Link href={`/clusters/${suggestion.cluster.id}`} className="text-sm text-brand-600 hover:underline">
              {suggestion.cluster.name}
            </Link>
            <span className="text-xs text-slate-400 ml-2">
              ({suggestion.cluster.pageCount} pages)
            </span>
          </div>
        )}
      </div>

      {/* Diff View */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Code Changes</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-red-700 mb-2">Original Code</h3>
            <pre className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm overflow-x-auto whitespace-pre-wrap">
              <code>{suggestion.originalCode}</code>
            </pre>
          </div>
          <div>
            <h3 className="text-sm font-medium text-green-700 mb-2">Suggested Fix</h3>
            <pre className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm overflow-x-auto whitespace-pre-wrap">
              <code>{suggestion.suggestedCode}</code>
            </pre>
          </div>
        </div>
      </div>

      {/* Validation Result */}
      {suggestion.validationResult && (
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Validation Result</h2>
          <pre className="bg-slate-50 rounded-lg p-3 text-sm overflow-x-auto">
            {JSON.stringify(suggestion.validationResult, null, 2)}
          </pre>
        </div>
      )}

      {/* Actions */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Actions</h2>
        <div className="flex flex-wrap gap-3">
          {(suggestion.status === 'DRAFT' || suggestion.status === 'VALIDATED') && (
            <form action={approveSuggestionAction}>
              <input type="hidden" name="suggestionId" value={suggestionId} />
              <button type="submit" className="btn-primary">
                Approve Suggestion
              </button>
            </form>
          )}

          {suggestion.status !== 'REJECTED' && suggestion.status !== 'APPLIED' && (
            <form action={rejectSuggestionAction}>
              <input type="hidden" name="suggestionId" value={suggestionId} />
              <button type="submit" className="btn-danger">
                Reject
              </button>
            </form>
          )}

          {(suggestion.status === 'APPROVED' || suggestion.status === 'VALIDATED') && (
            <form action={exportSnippetAction}>
              <input type="hidden" name="suggestionId" value={suggestionId} />
              <button type="submit" className="btn-secondary">
                Export as Snippet
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
