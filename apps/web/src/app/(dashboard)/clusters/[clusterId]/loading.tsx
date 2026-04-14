import { SkeletonCard } from "@aros/ui";

export default function ClusterDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
      <SkeletonCard lines={4} />
      <SkeletonCard lines={6} />
    </div>
  );
}
