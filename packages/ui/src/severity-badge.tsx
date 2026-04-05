import { clsx } from "clsx";

interface SeverityBadgeProps {
  severity: "CRITICAL" | "SERIOUS" | "MODERATE" | "MINOR";
}

const styles = {
  CRITICAL: "bg-red-100 text-red-800 ring-1 ring-inset ring-red-200",
  SERIOUS: "bg-orange-100 text-orange-800 ring-1 ring-inset ring-orange-200",
  MODERATE: "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200",
  /** Neutral: “lower impact” must not read as “passing”. */
  MINOR: "bg-slate-100 text-slate-800 ring-1 ring-inset ring-slate-200",
};

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[severity],
      )}
      aria-label={`Severity: ${severity.toLowerCase()}`}
    >
      {severity.toLowerCase()}
    </span>
  );
}
