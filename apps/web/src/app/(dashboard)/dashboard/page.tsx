import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import {
  resolveDashboardOrgMembership,
  runOrgScopedQuery,
} from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { hasPermission } from "@aros/config";

export const metadata = { title: "Dashboard - AROS" };

export default async function DashboardPage() {
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  const canViewSystem = await prisma.membership
    .findMany({ where: { userId: user.id }, select: { role: true } })
    .then((rows) => rows.some((m) => hasPermission(m.role, "org:system:view")))
    .catch(() => false);

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
    ] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: oid },
        select: { name: true },
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
    ]);

    if (!org) return null;

    return {
      orgName: org.name,
      sitesCount,
      openFindings,
      clustersCount,
      pendingReviews,
      recentCrawls,
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
  } = statsResult.data;

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
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Overview for {orgName}</p>
      </div>

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

      <div className="card h-48 flex items-center justify-center bg-slate-50 border-dashed border-2 border-slate-200" data-test-id="dynamic-chart">
        <p className="text-slate-400 italic">Trend analytics pending...</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/sites/new" className="btn-primary">
            Add Site
          </Link>
          <Link href="/findings" className="btn-secondary">
            View Findings
          </Link>
          <Link href="/reports" className="btn-secondary">
            Generate Report
          </Link>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Recent Crawls
        </h2>
        {recentCrawls.length === 0 ? (
          <p className="text-slate-500 text-sm">
            No crawls yet.{" "}
            <Link
              href="/sites/new"
              className="text-brand-600 hover:text-brand-700"
            >
              Add a site
            </Link>{" "}
            to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
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
                  <tr key={crawl.id} className="border-b border-slate-100">
                    <td className="py-2 font-medium text-slate-900">
                      {crawl.site.name}
                    </td>
                    <td className="py-2">
                      <CrawlStatusBadge status={crawl.status} />
                    </td>
                    <td className="py-2 text-right text-slate-600">
                      {crawl.pagesCrawled}/{crawl.pagesFound}
                    </td>
                    <td className="py-2 text-right text-slate-500">
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
  return (
    <Link href={href} className="card hover:shadow-md transition-shadow group">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
        {value.toLocaleString()}
      </p>
    </Link>
  );
}

function CrawlStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    COMPLETED: "bg-green-100 text-green-800",
    RUNNING: "bg-blue-100 text-blue-800",
    PENDING: "bg-slate-100 text-slate-800",
    FAILED: "bg-red-100 text-red-800",
    CANCELLED: "bg-slate-100 text-slate-500",
  };
  return (
    <span
      className={`badge ${styles[status] ?? "bg-slate-100 text-slate-800"}`}
    >
      {status.toLowerCase()}
    </span>
  );
}
