import { clsx } from "clsx";

interface StatusBadgeProps {
  status: string;
}

const styles: Record<string, string> = {
  // Finding statuses
  OPEN: "bg-red-100 text-red-800",
  ACKNOWLEDGED: "bg-amber-100 text-amber-900",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  RESOLVED: "bg-green-100 text-green-800",
  MITIGATED: "bg-emerald-100 text-emerald-900",
  WONT_FIX: "bg-slate-100 text-slate-600",
  FALSE_POSITIVE: "bg-slate-100 text-slate-600",
  // Scan/crawl statuses
  PENDING: "bg-amber-100 text-amber-800",
  RUNNING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELLED: "bg-slate-100 text-slate-500",
  // Suggestion statuses
  DRAFT: "bg-slate-100 text-slate-600",
  VALIDATED: "bg-green-100 text-green-800",
  FAILED_VALIDATION: "bg-red-100 text-red-800",
  APPROVED: "bg-blue-100 text-blue-800",
  EXPORTED: "bg-purple-100 text-purple-800",
  APPLIED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  // Review statuses
  NEEDS_CHANGES: "bg-orange-100 text-orange-800",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[status] ?? "bg-slate-100 text-slate-800",
      )}
    >
      {status.toLowerCase().replace(/_/g, " ")}
    </span>
  );
}
