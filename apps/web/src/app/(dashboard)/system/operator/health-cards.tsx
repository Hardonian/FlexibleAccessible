"use client";

import type { Route } from "next";
import Link from "next/link";
import type {
  StaleSite,
  AgedFinding,
  OrgWithSubscription,
  FailedRun,
  HighImpactCluster,
} from "./actions";

interface MetricCardProps {
  title: string;
  value: number | string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  status: "healthy" | "warning" | "critical" | "info";
  description?: string;
  href?: string;
  actionLabel?: string;
}

function MetricCard({
  title,
  value,
  trend,
  trendValue,
  status,
  description,
  href,
  actionLabel,
}: MetricCardProps) {
  const statusStyles = {
    healthy: "bg-emerald-50 border-emerald-200 text-emerald-900",
    warning: "bg-amber-50 border-amber-200 text-amber-900",
    critical: "bg-red-50 border-red-200 text-red-900",
    info: "bg-sky-50 border-sky-200 text-sky-900",
  };

  const trendIcons = {
    up: "↑",
    down: "↓",
    neutral: "→",
  };

  const content = (
    <div className={`rounded-2xl border p-5 ${statusStyles[status]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold">{value}</p>
          {trend && trendValue && (
            <p className="mt-1 text-xs font-medium">
              <span className="mr-1">{trendIcons[trend]}</span>
              {trendValue}
            </p>
          )}
        </div>
        {status === "critical" && (
          <span
            className="flex h-2 w-2 rounded-full bg-red-500"
            aria-hidden="true"
          />
        )}
        {status === "warning" && (
          <span
            className="flex h-2 w-2 rounded-full bg-amber-500"
            aria-hidden="true"
          />
        )}
      </div>
      {description && <p className="mt-3 text-sm opacity-80">{description}</p>}
      {href && actionLabel && (
        <Link
          href={href as Route}
          className="mt-4 inline-flex items-center text-sm font-medium underline underline-offset-2 hover:opacity-80"
        >
          {actionLabel} →
        </Link>
      )}
    </div>
  );

  if (href && !actionLabel) {
    return (
      <Link
        href={href as Route}
        className="block transition-transform hover:scale-[1.02]"
      >
        {content}
      </Link>
    );
  }

  return content;
}

interface AccountHealthCardsProps {
  staleSitesCount: number;
  criticalFindingsCount: number;
  subsNearRenewalCount: number;
  failedRunsCount: number;
}

export function AccountHealthCards({
  staleSitesCount,
  criticalFindingsCount,
  subsNearRenewalCount,
  failedRunsCount,
}: AccountHealthCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Stale Sites"
        value={staleSitesCount}
        status={
          staleSitesCount > 5
            ? "critical"
            : staleSitesCount > 0
              ? "warning"
              : "healthy"
        }
        description="Sites with no scan in 30+ days"
        href="/sites"
      />
      <MetricCard
        title="Aged Critical Findings"
        value={criticalFindingsCount}
        status={
          criticalFindingsCount > 10
            ? "critical"
            : criticalFindingsCount > 0
              ? "warning"
              : "healthy"
        }
        description="Open critical findings older than 90 days"
        href="/findings?impact=CRITICAL&status=OPEN"
      />
      <MetricCard
        title="Renewals Near"
        value={subsNearRenewalCount}
        status={subsNearRenewalCount > 0 ? "warning" : "healthy"}
        description="Subscriptions renewing in next 30 days"
        href="/settings/billing"
      />
      <MetricCard
        title="Failed Runs (7d)"
        value={failedRunsCount}
        status={
          failedRunsCount > 5
            ? "critical"
            : failedRunsCount > 0
              ? "warning"
              : "healthy"
        }
        description="Crawl/scan failures in last 7 days"
      />
    </div>
  );
}

interface RenewalWatchlistCardsProps {
  pastDueCount: number;
  failedPaymentCount: number;
  approachingLimitsCount: number;
  totalAtRisk: number;
}

export function RenewalWatchlistCards({
  pastDueCount,
  failedPaymentCount,
  approachingLimitsCount,
  totalAtRisk,
}: RenewalWatchlistCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="At Risk"
        value={totalAtRisk}
        status={totalAtRisk > 0 ? "critical" : "healthy"}
        description="Total organizations needing attention"
      />
      <MetricCard
        title="Past Due"
        value={pastDueCount}
        status={pastDueCount > 0 ? "critical" : "healthy"}
        description="Subscriptions with overdue payment"
        href="/settings/billing"
      />
      <MetricCard
        title="Failed Payment"
        value={failedPaymentCount}
        status={failedPaymentCount > 0 ? "critical" : "healthy"}
        description="Organizations with payment method failures"
        href="/settings/billing"
      />
      <MetricCard
        title="Near Limits"
        value={approachingLimitsCount}
        status={approachingLimitsCount > 0 ? "warning" : "healthy"}
        description="Orgs at 80%+ of site/seat limits"
      />
    </div>
  );
}

interface ExceptionRoutingCardsProps {
  criticalAgedCount: number;
  highImpactClustersCount: number;
  totalExceptions: number;
}

export function ExceptionRoutingCards({
  criticalAgedCount,
  highImpactClustersCount,
  totalExceptions,
}: ExceptionRoutingCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <MetricCard
        title="Total Exceptions"
        value={totalExceptions}
        status={
          totalExceptions > 20
            ? "critical"
            : totalExceptions > 5
              ? "warning"
              : "info"
        }
        description="High-value items requiring operator attention"
      />
      <MetricCard
        title="Aged Critical (>30d)"
        value={criticalAgedCount}
        status={
          criticalAgedCount > 5
            ? "critical"
            : criticalAgedCount > 0
              ? "warning"
              : "healthy"
        }
        description="Critical findings open for more than 30 days"
        href="/findings?impact=CRITICAL&status=OPEN"
      />
      <MetricCard
        title="High-Impact Clusters"
        value={highImpactClustersCount}
        status={highImpactClustersCount > 10 ? "warning" : "info"}
        description="Issue clusters with impact score ≥ 50"
        href="/clusters"
      />
    </div>
  );
}

interface DetailListsProps {
  staleSites: StaleSite[];
  criticalFindings: AgedFinding[];
  failedRuns: FailedRun[];
  subsNearRenewal: OrgWithSubscription[];
  highImpactClusters: HighImpactCluster[];
}

export function StaleSitesList({ sites }: { sites: StaleSite[] }) {
  if (sites.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm text-emerald-800">
          All sites are actively scanned.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {sites.slice(0, 10).map((site) => (
        <div
          key={site.id}
          className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3"
        >
          <div>
            <p className="font-medium text-slate-900">{site.name}</p>
            <p className="text-xs text-slate-500">{site.domain}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-slate-700">
              {site.daysStale}d stale
            </p>
            <p className="text-xs text-slate-500">
              {site.openFindings} open ({site.criticalFindings} critical)
            </p>
          </div>
        </div>
      ))}
      {sites.length > 10 && (
        <p className="text-center text-sm text-slate-500">
          +{sites.length - 10} more sites
        </p>
      )}
    </div>
  );
}

export function CriticalFindingsList({
  findings,
}: {
  findings: AgedFinding[];
}) {
  if (findings.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm text-emerald-800">No aged critical findings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {findings.slice(0, 10).map((finding) => (
        <Link
          key={finding.id}
          href={`/findings/${finding.id}`}
          className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-red-300 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="font-medium text-slate-900 truncate">
                {finding.ruleId}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {finding.siteDomain}
              </p>
            </div>
            <span className="ml-2 shrink-0 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
              {finding.daysOpen}d
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-600 line-clamp-2">
            {finding.description}
          </p>
        </Link>
      ))}
      {findings.length > 10 && (
        <p className="text-center text-sm text-slate-500">
          +{findings.length - 10} more findings
        </p>
      )}
    </div>
  );
}

export function FailedRunsList({ runs }: { runs: FailedRun[] }) {
  if (runs.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm text-emerald-800">
          No failed runs in last 7 days.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {runs.slice(0, 10).map((run) => (
        <div
          key={run.id}
          className="rounded-lg border border-slate-200 bg-white p-3"
        >
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                run.type === "crawl"
                  ? "bg-purple-100 text-purple-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {run.type}
            </span>
            <span className="text-xs text-slate-500">{run.siteDomain}</span>
          </div>
          {run.errorMessage && (
            <p className="mt-1 text-xs text-red-600 line-clamp-2">
              {run.errorMessage}
            </p>
          )}
        </div>
      ))}
      {runs.length > 10 && (
        <p className="text-center text-sm text-slate-500">
          +{runs.length - 10} more failures
        </p>
      )}
    </div>
  );
}

export function SubscriptionsList({ subs }: { subs: OrgWithSubscription[] }) {
  if (subs.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm text-emerald-800">
          No subscriptions nearing renewal.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {subs.map((sub) => (
        <div
          key={sub.id}
          className="rounded-lg border border-slate-200 bg-white p-3"
        >
          <div className="flex items-center justify-between">
            <p className="font-medium text-slate-900">{sub.name}</p>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                sub.subscription?.status === "PAST_DUE"
                  ? "bg-red-100 text-red-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {sub.subscription?.plan}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
            <span>{sub.siteCount} sites</span>
            {sub.daysToRenewal !== null && (
              <span>{sub.daysToRenewal}d to renewal</span>
            )}
            <span>{sub.usagePercent}% usage</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function HighImpactClustersList({
  clusters,
}: {
  clusters: HighImpactCluster[];
}) {
  if (clusters.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm text-emerald-800">
          No high-impact clusters found.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {clusters.slice(0, 10).map((cluster) => (
        <Link
          key={cluster.id}
          href={`/clusters/${cluster.id}`}
          className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-amber-300 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="font-medium text-slate-900 truncate">
                {cluster.name}
              </p>
              <p className="text-xs text-slate-500">{cluster.siteDomain}</p>
            </div>
            <span className="ml-2 shrink-0 text-sm font-bold text-amber-600">
              {cluster.impactScore}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
            <span>{cluster.findingCount} findings</span>
            <span>{cluster.pageCount} pages</span>
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 ${
                cluster.severity === "CRITICAL"
                  ? "bg-red-100 text-red-700"
                  : cluster.severity === "SERIOUS"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-amber-100 text-amber-700"
              }`}
            >
              {cluster.severity}
            </span>
          </div>
        </Link>
      ))}
      {clusters.length > 10 && (
        <p className="text-center text-sm text-slate-500">
          +{clusters.length - 10} more clusters
        </p>
      )}
    </div>
  );
}
