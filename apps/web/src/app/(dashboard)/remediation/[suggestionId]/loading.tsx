import { SkeletonCard } from "@aros/ui";

export default function SuggestionDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 animate-pulse rounded bg-slate-200" />
      <SkeletonCard lines={4} />
      <SkeletonCard lines={8} />
      <SkeletonCard lines={3} />
    </div>
  );
}
