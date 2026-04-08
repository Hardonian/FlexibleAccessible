import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { ArrowRight, Globe, Sparkles } from "lucide-react";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import {
  resolveDashboardOrgMembership,
  runOrgScopedQuery,
} from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { hasPermission } from "@aros/config";
import { EmptyState, StatusBadge } from "@aros/ui";
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
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <RouteReliabilityNotice
          variant="error"
          title="This page needs a working database"
          showSystemLink={canViewSystem}
        >
          <p>
            Organization data cannot be loaded safely right now. Fix core
            dependencies first, then refresh. The banner above summarizes what
            is wrong.
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "error") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
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
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
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
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
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
  const comparability = deriveComparabilityLabel(recentCrawls.map((crawl) => crawl.status));
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
          className="flex flex-col gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          role="status"
          aria-label="Free plan notice"
        >
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-brand-900">You are on the Free plan</p>
              <p className="mt-0.5 text-xs text-brand-700">
                Private workspace, scans, findings, exports, and automation require an active paid subscription.
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

      {/* Activation hub — prominent when workspace is not started */}
      {isFirstRun ? (
        <section
          className="overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-white to-brand-50/40"
          aria-labelledby="activation-hub-heading"
        >
          <div className="px-6 py-6 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
              Start here
            </p>
            <h2
              id="activation-hub-heading"
              className="mt-2 text-xl font-semibold text-slate-900"
            >
              Set up your first private workspace
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Add a site, run your first private scan, and start building an evidence record that your team can stand behind.
              Every step below unlocks the next.
            </p>
            <ol className="mt-5 space-y-3" aria-label="Activation steps">
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
            <span className="badge w-fit bg-slate-50 text-slate-800 ring-1 ring-inset ring-slate-200">
              {onboarding.stage.replaceAll("_", " ")}
            </span>
          </div>
          {onboarding.stage !== "first_value_reached" && (
            <p className="text-sm text-slate-600">
              Next step:{" "}
              <Link href={onboarding.nextStep.href as any} className="font-medium text-brand-700 underline underline-offset-2">
                {onboarding.nextStep.label}
              </Link>
              {onboarding.nextStep.blockerReason
                ? ` — Blocked: ${onboarding.nextStep.blockerReason}`
                : "."}
            </p>
          )}
          <ol className="space-y-2" aria-label="Onboarding checklist">
            {onboarding.stages.map((stage) => (
              <li key={stage.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">{stage.label}</p>
                  {stage.blockerReason && (
                    <p className="text-xs text-amber-700">{stage.blockerReason}</p>
                  )}
                </div>
                <span
                  className={`badge ${
                    stage.complete
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : stage.blocked
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-slate-100 text-slate-700 border border-slate-200"
                  }`}
                >
                  {stage.complete ? "Complete" : stage.blocked ? "Blocked" : "Pending"}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Priority actions — only show when there's meaningful data */}
      {(openFindings > 0 || pendingReviews > 0) && (
        <section className="card space-y-3" aria-labelledby="priority-actions-heading">
          <h2 id="priority-actions-heading" className="section-heading">Needs attention</h2>
          <div className="flex flex-wrap gap-3">
            {openFindings > 0 && (
              <Link
                href="/findings?status=OPEN"
                className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-800 transition-colors hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1"
              >
                {openFindings} open finding{openFindings !== 1 ? "s" : ""}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            )}
            {pendingReviews > 0 && (
              <Link
                href="/reviews"
                className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1"
              >
                {pendingReviews} pending review{pendingReviews !== 1 ? "s" : ""}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sites" value={sitesCount} href="/sites" />
        <StatCard label="Open Findings" value={openFindings} href="/findings" />
        <StatCard
          label="Issue Clusters"
          value={clustersCount}
          href="/clusters"
        />
        <StatCard
          label="Pending Reviews"
          value={pendingReviews}
          href="/reviews"
        />
      </div>

      <section className="card space-y-4" aria-labelledby="assurance-posture-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="assurance-posture-heading" className="section-heading">
            Assurance posture
          </h2>
          <span className="badge w-fit bg-slate-50 text-slate-800 ring-1 ring-inset ring-slate-200">
            {automationHealth}
          </span>
        </div>
        <p className="text-sm text-slate-600">
          Evidence freshness is <span className="font-medium text-slate-800">{freshness}</span>. Scan comparability is <span className="font-medium text-slate-800">{comparability}</span>.
          {latestCrawl
            ? " A fresh crawl and scan after each code change keeps evidence current."
            : " Run your first crawl to establish an evidence baseline."}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <TruthTile label="Evidence freshness" value={freshness} />
          <TruthTile label="Scan comparability" value={comparability} />
          <TruthTile label="Automation lane" value={automationHealth} />
        </div>
      </section>

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
            <table className="w-full text-sm">
              <caption className="sr-only">Recent crawl runs</caption>
              <thead>
                <tr className="border-b border-slate-200">
                  <th
                    scope="col"
                    className="pb-2 text-left font-medium text-slate-500"
                  >
                    Site
                  </th>
                  <th
                    scope="col"
                    className="pb-2 text-left font-medium text-slate-500"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="pb-2 text-right font-medium text-slate-500"
                  >
                    Pages
                  </th>
                  <th
                    scope="col"
                    className="pb-2 text-right font-medium text-slate-500"
                  >
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentCrawls.map((crawl) => (
                  <tr
                    key={crawl.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="py-3 font-medium text-slate-900">
                      {crawl.site.name}
                    </td>
                    <td className="py-3">
                      <StatusBadge status={crawl.status} />
                    </td>
                    <td className="py-3 text-right text-slate-600">
                      {crawl.pagesCrawled}/{crawl.pagesFound}
                    </td>
                    <td className="py-3 text-right text-slate-500">
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

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  const destinationLabel = `${label}: ${value.toLocaleString()}. Open ${label} details.`;
  return (
    <Link
      href={href as any}
      aria-label={destinationLabel}
      className="card hover:shadow-md transition-shadow block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 rounded-xl"
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value.toLocaleString()}</p>
      <p className="mt-2 text-xs font-medium text-brand-700">Open</p>
    </Link>
  );
}



function TruthTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
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

function deriveComparabilityLabel(statuses: string[]): string {
  if (statuses.length < 2) return "Not comparable yet";
  if (statuses.some((status) => status !== "COMPLETED")) {
    return "Not comparable (incomplete run in recent history)";
  }
  return "Comparable baseline available";
}
