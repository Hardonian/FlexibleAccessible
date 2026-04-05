import { clsx } from "clsx";
import {
  AlertTriangle,
  CircleAlert,
  CircleDot,
  CircleHelp,
  type LucideIcon,
} from "lucide-react";

export type SeverityLevel = "CRITICAL" | "SERIOUS" | "MODERATE" | "MINOR";

const config: Record<
  SeverityLevel,
  {
    label: string;
    Icon: LucideIcon;
    className: string;
  }
> = {
  CRITICAL: {
    label: "Critical",
    Icon: CircleAlert,
    className:
      "border-red-300 bg-red-50 text-red-900 ring-1 ring-inset ring-red-200",
  },
  SERIOUS: {
    label: "Serious",
    Icon: AlertTriangle,
    className:
      "border-orange-300 bg-orange-50 text-orange-950 ring-1 ring-inset ring-orange-200",
  },
  MODERATE: {
    label: "Moderate",
    Icon: CircleHelp,
    className:
      "border-amber-300 bg-amber-50 text-amber-950 ring-1 ring-inset ring-amber-200",
  },
  MINOR: {
    label: "Minor",
    Icon: CircleDot,
    className:
      "border-emerald-300 bg-emerald-50 text-emerald-950 ring-1 ring-inset ring-emerald-200",
  },
};

export interface SeverityChipProps {
  severity: SeverityLevel;
  /** Larger hit target / table cells */
  size?: "sm" | "md";
  className?: string;
}

export function SeverityChip({
  severity,
  size = "sm",
  className,
}: SeverityChipProps) {
  const { label, Icon, className: tone } = config[severity];
  const sizeCls =
    size === "md"
      ? "gap-2 px-3 py-1.5 text-sm min-h-[44px]"
      : "gap-1.5 px-2 py-0.5 text-xs";

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md border font-semibold",
        tone,
        sizeCls,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
      <span>{label}</span>
    </span>
  );
}
