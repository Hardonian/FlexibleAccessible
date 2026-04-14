import { SkeletonCard } from "@aros/ui";

export default function FindingsLoading() {
  return (
    <div className="space-y-6" aria-label="Loading findings" aria-busy="true">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-32 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-72 animate-pulse rounded bg-slate-100" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-28 animate-pulse rounded-lg bg-slate-200" aria-hidden="true" />
        ))}
      </div>

      {/* Finding row skeletons */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-l-4 border-slate-200 border-l-slate-300 bg-white shadow-sm"
            aria-hidden="true"
          >
            <div className="p-4 sm:p-5">
              <div className="flex items-start gap-4">
                <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                </div>
                <div className="h-6 w-20 animate-pulse rounded-full bg-slate-100" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
