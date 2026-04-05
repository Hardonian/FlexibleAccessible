import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Globe } from "lucide-react";
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

  return (
    <div className="space-y-8">
      {workerNote}
      <PageHeader
        title="Dashboard"
        description={`Operational overview for ${orgName}.`}
      />

      <section className="card space-y-4" aria-labelledby="onboarding-status-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="onboarding-status-heading" className="section-heading">
            Workspace readiness
          </h2>
          <span className="badge w-fit bg-slate-50 text-slate-800 ring-1 ring-inset ring-slate-200">
            {onboarding.stage.replaceAll("_", " ")}
          </span>
        </div>
        <p className="text-sm text-slate-600">
          Next step:{" "}
          <Link href={onboarding.nextStep.href as any} className="font-medium text-brand-700 underline">
            {onboarding.nextStep.label}
          </Link>
          {onboarding.nextStep.blockerReason
            ? ` — Blocked: ${onboarding.nextStep.blockerReason}`
            : "."}
        </p>
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

      <div className="card">
        <h2 className="section-heading mb-4">Next steps</h2>
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
            description="Add a site to get started with accessibility scanning."
            action={
              <Link href="/sites/new" className="btn-primary">
                Add a Site
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

