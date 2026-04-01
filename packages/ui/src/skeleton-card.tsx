import { clsx } from "clsx";

interface SkeletonCardProps {
  lines?: number;
  className?: string;
}

export function SkeletonCard({ lines = 3, className }: SkeletonCardProps) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-slate-200 bg-white p-6 shadow-sm",
        className,
      )}
      aria-hidden="true"
    >
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-4 animate-pulse rounded bg-slate-200"
            style={{ width: `${100 - i * 15}%` }}
          />
        ))}
      </div>
    </div>
  );
}

interface SkeletonTableRowProps {
  cols?: number;
}

export function SkeletonTableRow({ cols = 4 }: SkeletonTableRowProps) {
  return (
    <tr className="border-b border-slate-100" aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
        </td>
      ))}
    </tr>
  );
}
