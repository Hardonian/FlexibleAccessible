export type TruthState =
  | "implemented"
  | "partial"
  | "staged"
  | "not_supported"
  | "admin_configured"
  | "environment_dependent"
  | "requires_human_review";

const TRUTH_META: Record<TruthState, { label: string; className: string }> = {
  implemented: {
    label: "Implemented",
    className: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  partial: {
    label: "Partial",
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  staged: {
    label: "Staged",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  not_supported: {
    label: "Not supported",
    className: "bg-rose-100 text-rose-800 border-rose-200",
  },
  admin_configured: {
    label: "Admin configured",
    className: "bg-sky-100 text-sky-800 border-sky-200",
  },
  environment_dependent: {
    label: "Environment dependent",
    className: "bg-violet-100 text-violet-800 border-violet-200",
  },
  requires_human_review: {
    label: "Requires human review",
    className: "bg-orange-100 text-orange-800 border-orange-200",
  },
};

export function TruthBadge({
  state,
  className,
}: {
  state: TruthState;
  className?: string;
}) {
  const meta = TRUTH_META[state];

  return (
    <span
      className={["inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", meta.className, className]
        .filter(Boolean)
        .join(" ")}
    >
      {meta.label}
    </span>
  );
}
