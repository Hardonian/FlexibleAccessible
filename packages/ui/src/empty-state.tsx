import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
  /** Optional variant to tint the icon container */
  variant?: "default" | "brand" | "warning" | "error";
  className?: string;
}

const iconContainerStyles = {
  default: "bg-slate-100 ring-slate-200",
  brand:   "bg-brand-50 ring-brand-200",
  warning: "bg-amber-50 ring-amber-200",
  error:   "bg-red-50 ring-red-200",
};

const iconStyles = {
  default: "text-slate-400",
  brand:   "text-brand-500",
  warning: "text-amber-500",
  error:   "text-red-400",
};

export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
  variant = "default",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className,
      )}
      role="status"
      aria-label={title}
    >
      {Icon && (
        <div
          className={clsx(
            "mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ring-1",
            iconContainerStyles[variant],
          )}
          aria-hidden="true"
        >
          <Icon
            className={clsx("h-7 w-7", iconStyles[variant])}
            strokeWidth={1.5}
            aria-hidden="true"
          />
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
