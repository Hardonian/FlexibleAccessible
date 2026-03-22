import { clsx } from 'clsx';

interface StatusBadgeProps {
  status: string;
}

const styles: Record<string, string> = {
  OPEN: 'bg-red-100 text-red-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  FIXED: 'bg-green-100 text-green-800',
  WONT_FIX: 'bg-slate-100 text-slate-600',
  FALSE_POSITIVE: 'bg-slate-100 text-slate-600',
  PENDING: 'bg-amber-100 text-amber-800',
  RUNNING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-slate-100 text-slate-500',
  VALIDATED: 'bg-green-100 text-green-800',
  APPROVED: 'bg-blue-100 text-blue-800',
  REJECTED: 'bg-red-100 text-red-800',
  DRAFT: 'bg-slate-100 text-slate-600',
  EXPORTED: 'bg-purple-100 text-purple-800',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        styles[status] ?? 'bg-slate-100 text-slate-800'
      )}
    >
      {status.toLowerCase().replace(/_/g, ' ')}
    </span>
  );
}
