import { SkeletonCard } from "@aros/ui";

export default function SitesLoading() {
  return (
    <div className="space-y-6" aria-label="Loading sites" aria-busy="true">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-24 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-56 animate-pulse rounded bg-slate-100" />
      </div>

      {/* Metric strip skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl border border-slate-200 bg-white" aria-hidden="true" />
        ))}
      </div>

      {/* Site card skeletons */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} lines={4} />
        ))}
      </div>
    </div>
  );
}
