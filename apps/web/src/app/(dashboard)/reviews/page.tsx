import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { updateReviewAction } from './actions';

export const metadata = { title: 'Reviews - AROS' };

export default async function ReviewsPage() {
  await requireSession();

  const tasks = await prisma.reviewTask.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      assignee: { select: { name: true, email: true } },
      suggestion: {
        select: { type: true, originalCode: true, suggestedCode: true },
      },
      _count: { select: { evidence: true } },
    },
    take: 50,
  });

  const pendingCount = tasks.filter((t) => t.status === 'PENDING').length;
  const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Review Queue</h1>
        <p className="text-slate-500 mt-1">
          {pendingCount} pending, {inProgressCount} in progress
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        Some accessibility criteria cannot be verified by automated scanning alone.
        These tasks require human review for accurate conformance assessment.
      </div>

      {tasks.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-500">No review tasks yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <ReviewStatusBadge status={task.status} />
                    <span className="badge bg-slate-100 text-slate-700">
                      {task.type.toLowerCase().replace('_', ' ')}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">{task.title}</h3>
                  {task.description && (
                    <p className="text-sm text-slate-500 mt-1">{task.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                    {task.assignee && (
                      <span>Assigned to: {task.assignee.name ?? task.assignee.email}</span>
                    )}
                    <span>{task._count.evidence} evidence artifacts</span>
                    <span>Created: {task.createdAt.toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {task.status === 'PENDING' && (
                    <form action={updateReviewAction}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <input type="hidden" name="status" value="IN_PROGRESS" />
                      <button type="submit" className="btn-secondary text-xs">
                        Start Review
                      </button>
                    </form>
                  )}
                  {task.status === 'IN_PROGRESS' && (
                    <>
                      <form action={updateReviewAction}>
                        <input type="hidden" name="taskId" value={task.id} />
                        <input type="hidden" name="status" value="APPROVED" />
                        <button type="submit" className="btn-primary text-xs">
                          Approve
                        </button>
                      </form>
                      <form action={updateReviewAction}>
                        <input type="hidden" name="taskId" value={task.id} />
                        <input type="hidden" name="status" value="REJECTED" />
                        <button type="submit" className="btn-danger text-xs">
                          Reject
                        </button>
                      </form>
                    </>
                  )}
                  {task.suggestion && (
                    <Link
                      href={`/remediation/${task.suggestionId}`}
                      className="btn-ghost text-xs"
                    >
                      View Suggestion
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    NEEDS_CHANGES: 'bg-orange-100 text-orange-800',
  };
  return (
    <span className={`badge ${styles[status] ?? ''}`}>
      {status.toLowerCase().replace('_', ' ')}
    </span>
  );
}
