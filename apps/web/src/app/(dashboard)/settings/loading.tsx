import { SkeletonCard } from "@aros/ui";

export default function SettingsLoading() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="h-8 w-32 animate-pulse rounded bg-slate-200" />
      <SkeletonCard lines={4} />
      <SkeletonCard lines={6} />
      <SkeletonCard lines={3} />
    </div>
  );
}
