import { SkeletonCard } from "@aros/ui";

export default function SystemLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} lines={3} />
        ))}
      </div>
      <SkeletonCard lines={5} />
    </div>
  );
}
