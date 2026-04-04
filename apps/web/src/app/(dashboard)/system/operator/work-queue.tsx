"use client";

import Link from "next/link";
import { useTransition } from "react";
import type { WorkQueueItem } from "./actions";
import { dismissWorkQueueItem } from "./actions";

interface WorkQueueProps {
  items: WorkQueueItem[];
  highPriorityCount: number;
  mediumPriorityCount: number;
  onboardingCount: number;
}

const typeIcons: Record<WorkQueueItem["type"], string> = {
  onboarding: "🚀",
  attention: "⚠️",
  "churn-risk": "🚨",
};

const typeLabels: Record<WorkQueueItem["type"], string> = {
  onboarding: "Onboarding",
  attention: "Needs Attention",
  "churn-risk": "Churn Risk",
};

const priorityStyles: Record<WorkQueueItem["priority"], string> = {
  high: "border-l-4 border-red-500 bg-red-50/30",
  medium: "border-l-4 border-amber-500 bg-amber-50/30",
  low: "border-l-4 border-slate-300",
};

const priorityBadges: Record<WorkQueueItem["priority"], string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-slate-100 text-slate-800",
};

function WorkQueueItemCard({
  item,
  onDismiss,
}: {
  item: WorkQueueItem;
  onDismiss: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();

  const handleDismiss = () => {
    startTransition(() => {
      onDismiss(item.id);
    });
  };

  return (
    <div
      className={`group relative rounded-lg border border-slate-200 p-4 shadow-sm transition-all hover:shadow-md ${priorityStyles[item.priority]}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl" aria-hidden="true">
          {typeIcons[item.type]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900">{item.title}</h3>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${priorityBadges[item.priority]}`}
            >
              {item.priority}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
              {typeLabels[item.type]}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{item.description}</p>
          <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
            <span>{item.orgName}</span>
            <span>·</span>
            <time dateTime={item.createdAt.toISOString()}>
              {new Date(item.createdAt).toLocaleDateString()}
            </time>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Link
              href={item.actionHref}
              className="inline-flex items-center rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 transition-colors"
            >
              {item.actionLabel}
            </Link>
            <button
              onClick={handleDismiss}
              disabled={isPending}
              className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {isPending ? "Dismissing..." : "Dismiss"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorkQueue({
  items,
  highPriorityCount,
  mediumPriorityCount,
  onboardingCount,
}: WorkQueueProps) {
  const [isPending, startTransition] = useTransition();

  const handleDismiss = (itemId: string) => {
    startTransition(async () => {
      await dismissWorkQueueItem(itemId);
      // In a real implementation, this would refetch or update local state
      // For now, we'll reload the page
      window.location.reload();
    });
  };

  const filters = [
    { label: "All", count: items.length, value: "all" },
    { label: "High Priority", count: highPriorityCount, value: "high" },
    { label: "Medium", count: mediumPriorityCount, value: "medium" },
    { label: "Onboarding", count: onboardingCount, value: "onboarding" },
  ];

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {filters.map((filter) => (
          <div
            key={filter.value}
            className="rounded-lg border border-slate-200 bg-white p-3 text-center"
          >
            <p className="text-2xl font-bold text-slate-900">{filter.count}</p>
            <p className="text-xs text-slate-500">{filter.label}</p>
          </div>
        ))}
      </div>

      {/* Queue items */}
      {items.length === 0 ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-8 text-center">
          <p className="text-lg font-medium text-emerald-900">
            Work queue is clear!
          </p>
          <p className="mt-1 text-sm text-emerald-700">
            No items requiring operator attention at this time.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <WorkQueueItemCard
              key={item.id}
              item={item}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}

      {/* Priority guide */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h4 className="text-sm font-medium text-slate-900">Priority Guide</h4>
        <dl className="mt-2 grid gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full bg-red-500"
              aria-hidden="true"
            />
            <dt className="font-medium text-slate-700">High:</dt>
            <dd className="text-slate-600">
              Critical findings, churn risk, payment failures — address today
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full bg-amber-500"
              aria-hidden="true"
            />
            <dt className="font-medium text-slate-700">Medium:</dt>
            <dd className="text-slate-600">
              Sites needing attention, renewals approaching — address this week
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full bg-slate-400"
              aria-hidden="true"
            />
            <dt className="font-medium text-slate-700">Low:</dt>
            <dd className="text-slate-600">
              Routine onboarding, general maintenance
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

interface WorkQueueCompactProps {
  items: WorkQueueItem[];
  limit?: number;
}

export function WorkQueueCompact({ items, limit = 5 }: WorkQueueCompactProps) {
  const displayItems = items.slice(0, limit);

  return (
    <div className="space-y-2">
      {displayItems.map((item) => (
        <Link
          key={item.id}
          href={item.actionHref}
          className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:border-slate-300 hover:bg-slate-50 transition-colors"
        >
          <span className="text-lg">{typeIcons[item.type]}</span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-900 truncate">{item.title}</p>
            <p className="text-xs text-slate-500 truncate">
              {item.description}
            </p>
          </div>
          <span
            className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${priorityBadges[item.priority]}`}
          >
            {item.priority}
          </span>
        </Link>
      ))}
      {items.length > limit && (
        <p className="text-center text-sm text-slate-500">
          +{items.length - limit} more items
        </p>
      )}
      {items.length === 0 && (
        <p className="text-center text-sm text-slate-500 py-4">
          No pending items
        </p>
      )}
    </div>
  );
}
