import { SkeletonCard } from "@aros/ui";

export default function RemediationLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
      <SkeletonCard lines={2} />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} lines={3} />
        ))}
      </div>
    </div>
  );
}
