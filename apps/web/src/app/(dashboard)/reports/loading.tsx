import { SkeletonCard } from "@aros/ui";

export default function ReportsLoading() {
  return (
    <div className="space-y-6" aria-label="Loading reports" aria-busy="true">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-44 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-80 animate-pulse rounded bg-slate-100" />
      </div>

      {/* KPI grid skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-white" aria-hidden="true" />
        ))}
      </div>

      {/* Panel skeletons */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
        </div>
        <SkeletonCard lines={6} />
      </div>
    </div>
  );
}
