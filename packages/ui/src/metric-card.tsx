import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";

export interface MetricCardProps {
  label: string;
  value: string | number;
  subLabel?: string;
  /** Optional accent variant to visually distinguish metric type */
  variant?: "default" | "critical" | "warning" | "success" | "brand" | "neutral";
  icon?: LucideIcon;
  /** Makes the whole card a link target */
  as?: "div" | "article";
  className?: string;
  /** Show a colored left-border accent */
  accent?: boolean;
}

const variantStyles: Record<NonNullable<MetricCardProps["variant"]>, {
  icon: string;
  accent: string;
  value: string;
}> = {
  default:  { icon: "text-slate-400 bg-slate-100",   accent: "border-l-slate-300",  value: "text-slate-900" },
  neutral:  { icon: "text-slate-400 bg-slate-100",   accent: "border-l-slate-300",  value: "text-slate-900" },
  critical: { icon: "text-red-500 bg-red-50",        accent: "border-l-red-400",    value: "text-red-900"   },
  warning:  { icon: "text-amber-500 bg-amber-50",    accent: "border-l-amber-400",  value: "text-amber-900" },
  success:  { icon: "text-emerald-500 bg-emerald-50",accent: "border-l-emerald-400",value: "text-emerald-900" },
  brand:    { icon: "text-brand-600 bg-brand-50",    accent: "border-l-brand-500",  value: "text-brand-900" },
};

export function MetricCard({
  label,
  value,
  subLabel,
  variant = "default",
  icon: Icon,
  as: Tag = "div",
  className,
  accent = false,
}: MetricCardProps) {
  const styles = variantStyles[variant];

  return (
    <Tag
      className={clsx(
        "rounded-xl border border-slate-200 bg-white p-4",
        "shadow-[0_1px_3px_0_rgb(15_23_42/0.06),0_1px_2px_-1px_rgb(15_23_42/0.04)]",
        accent && ["border-l-4", styles.accent],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 leading-tight">
          {label}
        </p>
        {Icon && (
          <span
            className={clsx(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs",
              styles.icon,
            )}
            aria-hidden="true"
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
        )}
      </div>
      <p
        className={clsx(
          "mt-2 text-2xl font-bold tabular-nums leading-none",
          styles.value,
        )}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {subLabel && (
        <p className="mt-1 text-xs text-slate-500">{subLabel}</p>
      )}
    </Tag>
  );
}
