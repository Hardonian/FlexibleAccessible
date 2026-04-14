import { clsx } from "clsx";

interface StatusBadgeProps {
  status: string;
  label?: string;
}

type StatusConfig = {
  dot: string;
  bg: string;
  text: string;
};

const statusConfig: Record<string, StatusConfig> = {
  OPEN:             { dot: "bg-red-500",      bg: "bg-red-50",      text: "text-red-800"      },
  ACKNOWLEDGED:     { dot: "bg-amber-500",    bg: "bg-amber-50",    text: "text-amber-900"    },
  IN_PROGRESS:      { dot: "bg-blue-500",     bg: "bg-blue-50",     text: "text-blue-800"     },
  RESOLVED:         { dot: "bg-emerald-500",  bg: "bg-emerald-50",  text: "text-emerald-800"  },
  MITIGATED:        { dot: "bg-emerald-500",  bg: "bg-emerald-50",  text: "text-emerald-900"  },
  WONT_FIX:         { dot: "bg-slate-400",    bg: "bg-slate-100",   text: "text-slate-600"    },
  FALSE_POSITIVE:   { dot: "bg-slate-400",    bg: "bg-slate-100",   text: "text-slate-600"    },
  PENDING:          { dot: "bg-amber-400",    bg: "bg-amber-50",    text: "text-amber-800"    },
  RUNNING:          { dot: "bg-blue-500",     bg: "bg-blue-50",     text: "text-blue-800"     },
  COMPLETED:        { dot: "bg-emerald-500",  bg: "bg-emerald-50",  text: "text-emerald-800"  },
  FAILED:           { dot: "bg-red-500",      bg: "bg-red-50",      text: "text-red-800"      },
  CANCELLED:        { dot: "bg-slate-400",    bg: "bg-slate-100",   text: "text-slate-500"    },
  DRAFT:            { dot: "bg-slate-400",    bg: "bg-slate-100",   text: "text-slate-600"    },
  VALIDATED:        { dot: "bg-emerald-500",  bg: "bg-green-50",    text: "text-green-800"    },
  FAILED_VALIDATION:{ dot: "bg-red-500",      bg: "bg-red-50",      text: "text-red-800"      },
  APPROVED:         { dot: "bg-blue-500",     bg: "bg-blue-50",     text: "text-blue-800"     },
  EXPORTED:         { dot: "bg-violet-500",   bg: "bg-purple-50",   text: "text-purple-800"   },
  APPLIED:          { dot: "bg-emerald-500",  bg: "bg-green-50",    text: "text-green-800"    },
  REJECTED:         { dot: "bg-red-500",      bg: "bg-red-50",      text: "text-red-800"      },
  NEEDS_CHANGES:    { dot: "bg-orange-500",   bg: "bg-orange-50",   text: "text-orange-800"   },
};

const fallbackConfig: StatusConfig = {
  dot:  "bg-slate-400",
  bg:   "bg-slate-100",
  text: "text-slate-800",
};

function formatStatus(status: string): string {
  return status.toLowerCase().replace(/_/g, " ");
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const displayLabel = label ?? formatStatus(status);
  const ariaLabel = `Status: ${displayLabel}`;
  const cfg = statusConfig[status] ?? fallbackConfig;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        cfg.bg,
        cfg.text,
        // Ring matches text at low opacity
        cfg.text.replace("text-", "ring-").replace("-800", "-200").replace("-900", "-200").replace("-500", "-200").replace("-600", "-200"),
      )}
      aria-label={ariaLabel}
    >
      <span
        className={clsx("h-1.5 w-1.5 shrink-0 rounded-full", cfg.dot)}
        aria-hidden="true"
      />
      {displayLabel}
    </span>
  );
}
