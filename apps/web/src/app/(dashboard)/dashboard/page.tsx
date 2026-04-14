import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
  Globe,
  Layers,
  MessageSquare,
  Sparkles,
  Zap,
} from "lucide-react";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import {
  resolveDashboardOrgMembership,
  runOrgScopedQuery,
} from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { hasPermission } from "@aros/config";
import { EmptyState, MetricCard, StatusBadge } from "@aros/ui";
import { buildOnboardingStatus } from "@/lib/onboarding-status";
import { getEntitlementState } from "@/lib/auth-guard";
import { pageTitle } from "@/lib/product-brand";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: pageTitle("Dashboard") };

export default async function DashboardPage() {
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  let canViewSystem = false;
  try {
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      select: { role: true },
    });
    for (const membership of memberships) {
      if (hasPermission(membership.role, "org:system:view")) {
        canViewSystem = true;
        break;
      }
    }
  } catch {
    canViewSystem = false;
  }

  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind === "platform_blocked") {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <RouteReliabilityNotice
          variant="error"
          title="This page needs a working database"
          showSystemLink={canViewSystem}
        >
          <p>
            Organization data cannot be loaded safely right now. Fix core
            dependencies first, then refresh.
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <RouteReliabilityNotice
          variant="error"
          title="Data temporarily unavailable"
          showSystemLink={canViewSystem}
        >
          <p>We could not load your organization ({orgRes.message}).</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "none") {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <RouteReliabilityNotice variant="info" title="No organization found">
          <p>
            You do not have an organization membership yet. Contact an
            administrator to be added to a team.
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const statsResult = await runOrgScopedQuery(orgRes, async (oid) => {
    const [
      org,
      sitesCount,
      openFindings,
      clustersCount,
      pendingReviews,
      recentCrawls,
      crawlRunsCount,
      findingsCount,
    ] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: oid },
        select: {
          name: true,
          subscription: {
            select: {
              plan: true,
              status: true,
              maxDomains: true,
              maxPagesPerCrawl: true,
              maxScansPerMonth: true,
              maxSeats: true,
              aiEnabled: true,
              aiTokenLimit: true,
              currentPeriodEnd: true,
              cancelAtPeriodEnd: true,
            },
          },
        },
      }),
      prisma.site.count({
        where: { workspace: { organizationId: oid } },
      }),
      prisma.canonicalFinding.count({
        where: {
          status: "OPEN",
          occurrences: {
            some: { page: { site: { workspace: { organizationId: oid } } } },
          },
        },
      }),
      prisma.issueCluster.count({
        where: { site: { workspace: { organizationId: oid } } },
      }),
      prisma.reviewTask.count({
        where: {
          status: "PENDING",
          suggestion: {
            OR: [
              {
                finding: {
                  occurrences: {
                    some: {
                      page: { site: { workspace: { organizationId: oid } } },
                    },
                  },
                },
              },
              {
                cluster: { site: { workspace: { organizationId: oid } } },
              },
            ],
          },
        },
      }),
      prisma.crawlRun.findMany({
        where: { site: { workspace: { organizationId: oid } } },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { site: { select: { name: true, domain: true } } },
      }),
      prisma.crawlRun.count({
        where: { site: { workspace: { organizationId: oid } } },
      }),
      prisma.canonicalFinding.count({
        where: {
          site: { workspace: { organizationId: oid } },
        },
      }),
    ]);

    if (!org) return null;

    return {
      orgName: org.name,
      sitesCount,
      openFindings,
      clustersCount,
      pendingReviews,
      recentCrawls,
      crawlRunsCount,
      findingsCount,
      entitlement: getEntitlementState(org.subscription),
    };
  });

  if (!statsResult.ok || !statsResult.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <RouteReliabilityNotice
          variant="error"
          title="Dashboard metrics unavailable"
          showSystemLink={canViewSystem}
        >
          <p>
            {statsResult.ok
              ? "Organization context was lost."
              : `Could not load metrics (${statsResult.message}).`}
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const {
    orgName,
    sitesCount,
    openFindings,
    clustersCount,
    pendingReviews,
    recentCrawls,
    crawlRunsCount,
    findingsCount,
    entitlement,
  } = statsResult.data;
  const onboarding = buildOnboardingStatus({
    sitesCount,
    crawlRunsCount,
    findingsCount,
    entitlement,
    workerRunning: platformTruth.flags.workerRunning,
    jobPipelinesHealthy: platformTruth.flags.jobPipelinesHealthy,
  });

  const latestCrawl = recentCrawls[0] ?? null;
  const freshness = deriveFreshnessLabel(latestCrawl?.createdAt ?? null);
  const freshnessVariant = deriveFreshnessVariant(latestCrawl?.createdAt ?? null);
  const comparability = deriveComparabilityLabel(recentCrawls.map((c) => c.status));
  const automationHealth =
    platformTruth.flags.workerRunning &&
    platformTruth.flags.jobPipelinesHealthy &&
    platformTruth.flags.redisOk
      ? "Automated"
      : "Degraded";

  const workerNote =
    platformTruth.shellBlocker === "none" &&
    !platformTruth.flags.workerRunning ? (
      <RouteReliabilityNotice
        variant="warning"
        title="Background processing paused"
        showSystemLink={canViewSystem}
      >
        <p>
          Workers are not running. New crawls and queued jobs will not complete
          until the worker process is started and Redis is healthy.
        </p>
      </RouteReliabilityNotice>
    ) : null;

  const isFirstRun = onboarding.stage === "not_started";

  return (
    <div className="space-y-6">
      {workerNote}

      {/* Free-plan upgrade banner */}
      {!entitlement.hasPaidAccess && (
        <div
          className="flex flex-col gap-3 rounded-xl border border-brand-200 bg-gradient-to-r from-brand-50 to-white px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
          role="status"
          aria-label="Free plan notice"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100">
              <Sparkles className="h-4 w-4 text-brand-600" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-brand-900">You are on the Free plan</p>
              <p className="mt-0.5 text-xs text-brand-700">
                Private scans, findings, exports, and automation require an active subscription.
              </p>
            </div>
          </div>
          <Link
            href="/settings/billing"
            className="btn-primary shrink-0 self-start text-sm sm:self-auto"
          >
            View plans
          </Link>
        </div>
      )}

      <PageHeader
        title="Dashboard"
        description={`Operational overview for ${orgName}.`}
      />

      {/* ── Activation hub ─────────────────────────────────────────────── */}
      {isFirstRun ? (
        <section
          className="overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-white to-brand-50/40"
          aria-labelledby="activation-hub-heading"
        >
          <div className="px-6 py-6 sm:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-600">
              Start here
            </p>
            <h2
              id="activation-hub-heading"
              className="mt-2 text-xl font-semibold text-slate-900"
            >
              Set up your first private workspace
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-500">
              Add a site, run your first private scan, and build an evidence record your team can stand behind.
            </p>
            <ol className="mt-5 space-y-2.5" aria-label="Activation steps">
              {onboarding.stages.map((stage, i) => (
                <li
                  key={stage.id}
                  className={`flex items-start gap-4 rounded-xl border px-4 py-3 ${
                    stage.complete
                      ? "border-emerald-200 bg-emerald-50/60"
                      : stage.blocked
                        ? "border-amber-200 bg-amber-50/60"
                        : i === onboarding.stages.findIndex((s) => !s.complete)
                          ? "border-brand-300 bg-white shadow-sm"
                          : "border-slate-200 bg-slate-50/60"
                  }`}
                >
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      stage.complete
                        ? "bg-emerald-600 text-white"
                        : stage.blocked
                          ? "bg-amber-200 text-amber-900"
                          : "bg-brand-600 text-white"
                    }`}
                    aria-hidden="true"
                  >
                    {stage.complete ? "✓" : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{stage.label}</p>
                    {stage.blockerReason && (
                      <p className="mt-0.5 text-xs text-amber-800">{stage.blockerReason}</p>
                    )}
                  </div>
                  {!stage.complete && !stage.blocked && (
                    <Link
                      href={stage.href as any}
                      className="flex shrink-0 items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-1"
                    >
                      Go
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : (
        <section className="card space-y-4" aria-labelledby="onboarding-status-heading">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 id="onboarding-status-heading" className="section-heading">
              Workspace readiness
            </h2>
            <span className="badge w-fit bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-200">
              {onboarding.stage.replaceAll("_", " ")}
            </span>
          </div>
          {onboarding.stage !== "first_value_reached" && (
            <p className="text-sm text-slate-600">
              Next:{" "}
              <Link href={onboarding.nextStep.href as any} className="font-medium text-brand-700 underline underline-offset-2">
                {onboarding.nextStep.label}
              </Link>
              {onboarding.nextStep.blockerReason
                ? ` — Blocked: ${onboarding.nextStep.blockerReason}`
                : "."}
            </p>
          )}
          <ol className="space-y-1.5" aria-label="Onboarding checklist">
            {onboarding.stages.map((stage) => (
              <li key={stage.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      stage.complete
                        ? "bg-emerald-500 text-white"
                        : stage.blocked
                          ? "bg-amber-200 text-amber-900"
                          : "bg-slate-200 text-slate-600"
                    }`}
                    aria-hidden="true"
                  >
                    {stage.complete ? "✓" : ""}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{stage.label}</p>
                    {stage.blockerReason && (
                      <p className="text-xs text-amber-700">{stage.blockerReason}</p>
                    )}
                  </div>
                </div>
                <span
                  className={`badge shrink-0 ${
                    stage.complete
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                      : stage.blocked
                        ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200"
                        : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200"
                  }`}
                >
                  {stage.complete ? "Complete" : stage.blocked ? "Blocked" : "Pending"}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ── Priority actions ─────────────────────────────────────────────── */}
      {(openFindings > 0 || pendingReviews > 0) && (
        <section aria-labelledby="priority-actions-heading">
          <h2 id="priority-actions-heading" className="sr-only">Needs attention</h2>
          <div className="flex flex-wrap gap-3">
            {openFindings > 0 && (
              <Link
                href="/findings?status=OPEN"
                className="group flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 transition-all hover:bg-red-100 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 group-hover:bg-red-200 transition-colors" aria-hidden="true">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </span>
                <div>
                  <p className="font-semibold">{openFindings.toLocaleString()} open finding{openFindings !== 1 ? "s" : ""}</p>
                  <p className="text-xs font-normal text-red-700">Review and triage</p>
                </div>
                <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </Link>
            )}
            {pendingReviews > 0 && (
              <Link
                href="/reviews"
                className="group flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 transition-all hover:bg-amber-100 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 group-hover:bg-amber-200 transition-colors" aria-hidden="true">
                  <MessageSquare className="h-4 w-4 text-amber-600" />
                </span>
                <div>
                  <p className="font-semibold">{pendingReviews.toLocaleString()} pending review{pendingReviews !== 1 ? "s" : ""}</p>
                  <p className="text-xs font-normal text-amber-700">Manual verification needed</p>
                </div>
                <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              </Link>
            )}
          </div>
        </section>
      )}

      {/* ── Key metrics ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Sites"
          value={sitesCount}
          icon={Globe}
          variant={sitesCount === 0 ? "neutral" : "brand"}
          accent
          subLabel="monitored targets"
          as="article"
        />
        <MetricCard
          label="Open findings"
          value={openFindings}
          icon={AlertTriangle}
          variant={openFindings > 0 ? "critical" : "success"}
          accent
          subLabel={openFindings > 0 ? "need attention" : "all clear"}
          as="article"
        />
        <MetricCard
          label="Issue clusters"
          value={clustersCount}
          icon={Layers}
          variant="neutral"
          accent
          subLabel="grouped patterns"
          as="article"
        />
        <MetricCard
          label="Pending reviews"
          value={pendingReviews}
          icon={MessageSquare}
          variant={pendingReviews > 0 ? "warning" : "neutral"}
          accent
          subLabel={pendingReviews > 0 ? "awaiting action" : "queue clear"}
          as="article"
        />
      </div>

      {/* ── Assurance posture ────────────────────────────────────────────── */}
      <section className="card space-y-4" aria-labelledby="assurance-posture-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="assurance-posture-heading" className="section-heading">
            Assurance posture
          </h2>
          <span
            className={`badge w-fit ring-1 ring-inset ${
              automationHealth === "Automated"
                ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                : "bg-amber-50 text-amber-800 ring-amber-200"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${automationHealth === "Automated" ? "bg-emerald-500" : "bg-amber-500"}`}
              aria-hidden="true"
            />
            {automationHealth}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <PostureTile
            label="Evidence freshness"
            value={freshness}
            variant={freshnessVariant}
            icon={Clock}
          />
          <PostureTile
            label="Scan comparability"
            value={comparability}
            variant={
              comparability.startsWith("Comparable")
                ? "success"
                : comparability.startsWith("Not comparable")
                  ? "warning"
                  : "neutral"
            }
            icon={CheckCircle}
          />
          <PostureTile
            label="Automation lane"
            value={automationHealth}
            variant={automationHealth === "Automated" ? "success" : "warning"}
            icon={Zap}
          />
        </div>
      </section>

      {/* ── Quick actions ────────────────────────────────────────────────── */}
      <div className="card">
        <h2 className="section-heading mb-4">Quick actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/sites/new" className="btn-primary">
            Add site
          </Link>
          <Link href="/findings" className="btn-secondary">
            Review findings
          </Link>
          <Link href="/reports" className="btn-secondary">
            Export evidence report
          </Link>
        </div>
      </div>

      {/* ── Recent crawls ────────────────────────────────────────────────── */}
      <div className="card">
        <h2 className="section-heading mb-4">Recent crawls</h2>
        {recentCrawls.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No crawls yet"
            description="Add a site and run your first crawl to begin collecting accessibility evidence."
            action={
              <Link href="/sites/new" className="btn-primary">
                Add a site
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="data-table">
              <caption className="sr-only">Recent crawl runs</caption>
              <thead>
                <tr>
                  <th scope="col">Site</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">Pages</th>
                  <th scope="col" className="text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentCrawls.map((crawl) => (
                  <tr key={crawl.id}>
                    <td className="font-medium text-slate-900">
                      {crawl.site.name}
                    </td>
                    <td>
                      <StatusBadge status={crawl.status} />
                    </td>
                    <td className="text-right tabular-nums text-slate-600">
                      {crawl.pagesCrawled}/{crawl.pagesFound}
                    </td>
                    <td className="text-right text-slate-500">
                      <time dateTime={crawl.createdAt.toISOString()}>
                        {crawl.createdAt.toLocaleDateString()}
                      </time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** Assurance posture tile with colored left-border and icon */
function PostureTile({
  label,
  value,
  variant,
  icon: Icon,
}: {
  label: string;
  value: string;
  variant: "success" | "warning" | "neutral" | "brand";
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}) {
  const styles = {
    success: { border: "border-l-emerald-400", icon: "text-emerald-500", text: "text-emerald-900" },
    warning: { border: "border-l-amber-400",   icon: "text-amber-500",   text: "text-amber-900"   },
    neutral: { border: "border-l-slate-300",   icon: "text-slate-400",   text: "text-slate-900"   },
    brand:   { border: "border-l-brand-400",   icon: "text-brand-500",   text: "text-brand-900"   },
  }[variant];

  return (
    <div className={`flex items-start gap-3 rounded-lg border border-l-4 border-slate-200 bg-white px-3 py-3 shadow-[0_1px_2px_0_rgb(15_23_42/0.04)] ${styles.border}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${styles.icon}`} aria-hidden={true} />
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className={`mt-0.5 text-sm font-semibold ${styles.text}`}>{value}</p>
      </div>
    </div>
  );
}

function deriveFreshnessLabel(createdAt: Date | null): string {
  if (!createdAt) return "Missing evidence";
  const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  if (ageHours <= 24) return "Verified window (≤24h)";
  if (ageHours <= 72) return "Fresh (≤72h)";
  return "Stale (>72h)";
}

function deriveFreshnessVariant(createdAt: Date | null): "success" | "warning" | "neutral" {
  if (!createdAt) return "warning";
  const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  if (ageHours <= 72) return "success";
  return "warning";
}

function deriveComparabilityLabel(statuses: string[]): string {
  if (statuses.length < 2) return "Not comparable yet";
  if (statuses.some((s) => s !== "COMPLETED")) {
    return "Not comparable (incomplete run in recent history)";
  }
  return "Comparable baseline available";
}
