import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasPermission } from "@aros/config";
import type { MemberRole } from "@aros/db";
import { getOperatorHealthData } from "./actions";
import {
  AccountHealthCards,
  RenewalWatchlistCards,
  ExceptionRoutingCards,
  StaleSitesList,
  CriticalFindingsList,
  FailedRunsList,
  SubscriptionsList,
  HighImpactClustersList,
} from "./health-cards";
import { WorkQueue, WorkQueueCompact } from "./work-queue";

export const metadata = { title: "Operator Dashboard - AROS" };

export default async function OperatorDashboardPage() {
  const user = await requireSession();

  // Get user's membership with organization
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    include: { organization: { select: { id: true, name: true, slug: true } } },
  });

  if (!membership) {
    return (
      <div className="card text-center py-12">
        <h1 className="text-lg font-semibold text-slate-900">
          No organization
        </h1>
        <p className="text-slate-500 mt-2">
          You need an organization membership to view the operator dashboard.
        </p>
      </div>
    );
  }

  // Check permission
  if (!hasPermission(membership.role as MemberRole, "org:system:view")) {
    redirect("/dashboard");
  }

  const canManage = hasPermission(
    membership.role as MemberRole,
    "org:system:manage",
  );

  // Load operator health data
  let data: Awaited<ReturnType<typeof getOperatorHealthData>> | null = null;
  let loadError: string | null = null;

  try {
    data = await getOperatorHealthData();
  } catch (e) {
    loadError =
      e instanceof Error ? e.message : "Failed to load operator health data";
    console.error("[operator] health data load failed", e);
  }

  if (loadError || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Operator Dashboard
          </h1>
          <p className="text-slate-500 mt-1">
            Real-time account health, work queues, and exception routing for
            managed services.
          </p>
        </div>
        <div
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900"
          role="alert"
        >
          <p className="font-medium">Could not load operator data</p>
          <p className="mt-1">{loadError}</p>
          <p className="mt-2 text-red-800">
            Check database connectivity or contact support if this persists.
          </p>
        </div>
      </div>
    );
  }

  const { accountHealth, workQueue, renewalWatchlist, exceptionRouting } = data;

  // Calculate overall health score
  const healthMetrics = [
    accountHealth.staleSitesCount === 0,
    accountHealth.criticalFindingsCount === 0,
    accountHealth.failedRunsCount === 0,
    renewalWatchlist.totalAtRisk === 0,
  ];
  const healthScore = Math.round(
    (healthMetrics.filter(Boolean).length / healthMetrics.length) * 100,
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Operator Dashboard
          </h1>
          <p className="text-slate-500 mt-1">
            Real-time account health, work queues, and exception routing for{" "}
            {membership.organization.name}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${
              healthScore >= 75
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : healthScore >= 50
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                healthScore >= 75
                  ? "bg-emerald-500"
                  : healthScore >= 50
                    ? "bg-amber-500"
                    : "bg-red-500"
              }`}
              aria-hidden="true"
            />
            Health Score: {healthScore}%
          </div>
          <Link
            href="/system"
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            System Status →
          </Link>
        </div>
      </div>

      {/* View-only notice for non-managers */}
      {!canManage && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          <span className="font-medium">View-only mode:</span> Your role can
          view operator dashboards but cannot dismiss work items or run actions.
          Contact an owner or admin for changes.
        </div>
      )}

      {/* Main grid layout */}
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        {/* Left column: Primary metrics and work queue */}
        <div className="space-y-8">
          {/* Account Health Section */}
          <section className="card" aria-labelledby="health-heading">
            <div className="flex items-center justify-between mb-4">
              <h2
                id="health-heading"
                className="text-lg font-semibold text-slate-900"
              >
                Account Health Rollup
              </h2>
              <Link
                href="/sites"
                className="text-sm text-brand-600 hover:text-brand-700"
              >
                Manage sites →
              </Link>
            </div>
            <AccountHealthCards
              staleSitesCount={accountHealth.staleSitesCount}
              criticalFindingsCount={accountHealth.criticalFindingsCount}
              subsNearRenewalCount={accountHealth.subsNearRenewalCount}
              failedRunsCount={accountHealth.failedRunsCount}
            />

            {/* Detail sections */}
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium text-slate-900 mb-2">
                  Stale Sites ({accountHealth.staleSitesCount})
                </h3>
                <StaleSitesList sites={accountHealth.staleSites} />
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-900 mb-2">
                  Failed Runs ({accountHealth.failedRunsCount})
                </h3>
                <FailedRunsList runs={accountHealth.failedRuns} />
              </div>
            </div>
          </section>

          {/* Customer Work Queue - Full version */}
          <section className="card" aria-labelledby="queue-heading">
            <h2
              id="queue-heading"
              className="text-lg font-semibold text-slate-900 mb-4"
            >
              Customer Work Queue
            </h2>
            <WorkQueue
              items={workQueue.items}
              highPriorityCount={workQueue.highPriorityCount}
              mediumPriorityCount={workQueue.mediumPriorityCount}
              onboardingCount={workQueue.onboardingCount}
            />
          </section>

          {/* Exception Routing */}
          <section className="card" aria-labelledby="exceptions-heading">
            <h2
              id="exceptions-heading"
              className="text-lg font-semibold text-slate-900 mb-4"
            >
              High-Value Exception Routing
            </h2>
            <ExceptionRoutingCards
              criticalAgedCount={exceptionRouting.criticalAgedFindings.length}
              highImpactClustersCount={
                exceptionRouting.highImpactClusters.length
              }
              totalExceptions={exceptionRouting.totalExceptions}
            />
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium text-slate-900 mb-2">
                  Aged Critical Findings (
                  {exceptionRouting.criticalAgedFindings.length})
                </h3>
                <CriticalFindingsList
                  findings={exceptionRouting.criticalAgedFindings}
                />
              </div>
              <div>
                <h3 className="text-sm font-medium text-slate-900 mb-2">
                  High-Impact Clusters (
                  {exceptionRouting.highImpactClusters.length})
                </h3>
                <HighImpactClustersList
                  clusters={exceptionRouting.highImpactClusters}
                />
              </div>
            </div>
          </section>
        </div>

        {/* Right column: Sidebar with watchlists */}
        <div className="space-y-6">
          {/* Quick actions card */}
          <div className="card bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
              Quick Actions
            </h2>
            <ul className="mt-4 space-y-2">
              <li>
                <Link
                  href="/sites/new"
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 transition-colors"
                >
                  <span>Add new site</span>
                  <span aria-hidden="true">+</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/findings?status=OPEN"
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 transition-colors"
                >
                  <span>Review open findings</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/clusters"
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 transition-colors"
                >
                  <span>View clusters</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Renewal/Failure Watchlist */}
          <section className="card" aria-labelledby="renewal-heading">
            <h2
              id="renewal-heading"
              className="text-lg font-semibold text-slate-900 mb-4"
            >
              Renewal Watchlist
            </h2>
            <RenewalWatchlistCards
              pastDueCount={renewalWatchlist.pastDue.length}
              failedPaymentCount={renewalWatchlist.failedPayment.length}
              approachingLimitsCount={renewalWatchlist.approachingLimits.length}
              totalAtRisk={renewalWatchlist.totalAtRisk}
            />
            <div className="mt-4">
              {renewalWatchlist.pastDue.length > 0 ? (
                <SubscriptionsList subs={renewalWatchlist.pastDue} />
              ) : renewalWatchlist.approachingLimits.length > 0 ? (
                <SubscriptionsList subs={renewalWatchlist.approachingLimits} />
              ) : (
                <p className="text-sm text-slate-500 py-4 text-center">
                  No subscriptions requiring immediate attention.
                </p>
              )}
            </div>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <Link
                href="/settings/billing"
                className="text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                Manage billing →
              </Link>
            </div>
          </section>

          {/* Compact Work Queue */}
          <section className="card" aria-labelledby="queue-compact-heading">
            <h2
              id="queue-compact-heading"
              className="text-lg font-semibold text-slate-900 mb-4"
            >
              Top Priorities
            </h2>
            <WorkQueueCompact items={workQueue.items} limit={5} />
          </section>

          {/* Data freshness */}
          <div className="text-center">
            <p className="text-xs text-slate-400">
              Last updated: {new Date(data.generatedAt).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
