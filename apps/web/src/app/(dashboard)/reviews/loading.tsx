import { SkeletonCard } from "@aros/ui";

export default function ReviewsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
      <SkeletonCard lines={1} />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} lines={5} />
        ))}
      </div>
    </div>
  );
}
