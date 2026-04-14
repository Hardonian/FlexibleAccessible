import { SkeletonCard } from "@aros/ui";

export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-label="Loading dashboard" aria-busy="true">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-40 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-64 animate-pulse rounded bg-slate-100" />
      </div>

      {/* Metric cards skeleton */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            aria-hidden="true"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
              <div className="h-6 w-6 animate-pulse rounded-md bg-slate-100" />
            </div>
            <div className="h-8 w-16 animate-pulse rounded bg-slate-200" />
            <div className="mt-1.5 h-3 w-24 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>

      {/* Assurance posture skeleton */}
      <SkeletonCard lines={4} />

      {/* Recent crawls skeleton */}
      <SkeletonCard lines={5} />
    </div>
  );
}
