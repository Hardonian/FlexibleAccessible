import { clsx } from "clsx";

interface ConfidenceBarProps {
  /** Value from 0–1 (e.g. 0.75 for 75%) */
  value: number;
  /** Show the percentage label next to the bar */
  showLabel?: boolean;
  className?: string;
}

export function ConfidenceBar({
  value,
  showLabel = true,
  className,
}: ConfidenceBarProps) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const fillColor =
    pct >= 70 ? "bg-emerald-400" : pct >= 40 ? "bg-amber-400" : "bg-red-400";

  return (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      {showLabel && (
        <span className="text-sm font-semibold tabular-nums text-slate-900">
          {pct}%
        </span>
      )}
      <span
        className="block h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"
        role="meter"
        aria-label={`${pct}% confidence`}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          className={clsx("block h-full rounded-full", fillColor)}
          style={{ width: `${pct}%` }}
        />
      </span>
    </span>
  );
}
