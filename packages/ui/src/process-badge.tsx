import { clsx } from "clsx";

/** Crawl / scan / job lifecycle states used across dashboard tables and lists. */
export type ProcessStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | string;

const styles: Record<string, string> = {
  COMPLETED: "bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-200",
  RUNNING: "bg-sky-50 text-sky-900 ring-1 ring-inset ring-sky-200",
  PENDING: "bg-slate-100 text-slate-800 ring-1 ring-inset ring-slate-200",
  FAILED: "bg-red-50 text-red-900 ring-1 ring-inset ring-red-200",
  CANCELLED: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200",
};

function formatProcessLabel(status: string): string {
  return status.toLowerCase().replace(/_/g, " ");
}

export function ProcessBadge({ status }: { status: ProcessStatus }) {
  const label = formatProcessLabel(status);
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        styles[status] ?? "bg-slate-100 text-slate-800 ring-1 ring-inset ring-slate-200",
      )}
      aria-label={`Status: ${label}`}
    >
      {label}
    </span>
  );
}
