interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  label?: string;
  fullScreen?: boolean;
}

const sizes = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

export function LoadingSpinner({
  size = "md",
  label = "Loading...",
  fullScreen = false,
}: LoadingSpinnerProps) {
  const spinner = (
    <svg
      className={`animate-spin text-brand-600 ${sizes[size]}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );

  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm"
        role="status"
        aria-live="polite"
        aria-label={label}
      >
        <div className="flex flex-col items-center gap-3">
          {spinner}
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2" role="status">
      {spinner}
      <span className="sr-only">{label}</span>
    </div>
  );
}
