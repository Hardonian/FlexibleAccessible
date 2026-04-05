import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { generateReportAction } from "./actions";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import {
  resolveDashboardOrgMembership,
  runOrgScopedQuery,
} from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { hasPermission } from "@aros/config";
import { buildFindingsOperationalSummary } from "@/lib/findings/reporting-summary";
import { PageHeader } from "@/components/layout/page-header";
import { pageTitle } from "@/lib/product-brand";

export const metadata = { title: pageTitle("Reports") };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ report_error?: string }>;
}) {
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  const params = await searchParams;
  const canViewSystem = await prisma.membership
    .findMany({ where: { userId: user.id }, select: { role: true } })
    .then((rows) => rows.some((m) => hasPermission(m.role, "org:system:view")))
    .catch(() => false);

  const reportError =
    params.report_error === "no_org"
      ? "Could not determine your organization. Please try again."
      : params.report_error === "query_failed"
        ? "Report query failed. Please try again or contact support."
        : null;

  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind === "platform_blocked") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Evidence Reports</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Reports require a working database"
          showSystemLink={canViewSystem}
        >
          <p>
            Report data cannot be loaded until core data services are healthy.
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "error") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Evidence Reports</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Could not verify organization"
          showSystemLink={canViewSystem}
        >
          <p>{orgRes.message}</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "none") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Evidence Reports</h1>
        <RouteReliabilityNotice
          variant="info"
          title="No organization membership"
        >
          <p>You need an organization to generate reports.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const statsResult = await runOrgScopedQuery(orgRes, async (orgId) => {
    const [sites, opSummary] = await Promise.all([
      prisma.site.findMany({
        where: { workspace: { organizationId: orgId } },
        select: { id: true, name: true, domain: true },
      }),
      buildFindingsOperationalSummary(
        prisma,
        orgId,
        platformTruth.flags.jobPipelinesHealthy,
      ),
    ]);
    return { opSummary, sites };
  });

  if (!statsResult.ok) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Evidence Reports</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Could not load report summary"
          showSystemLink={canViewSystem}
        >
          <p>{statsResult.message}</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const { opSummary, sites } = statsResult.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Evidence reports"
        description="Export structured findings data for audits, tickets, and stakeholder updates. This is evidence of testing activity—not a legal conformance certificate."
      />

      {reportError && (
        <RouteReliabilityNotice
          variant="error"
          title="Report generation failed"
        >
          <p>{reportError}</p>
        </RouteReliabilityNotice>
      )}

      {!platformTruth.flags.jobPipelinesHealthy && (
        <RouteReliabilityNotice
          variant="warning"
          title="Background pipelines degraded"
          showSystemLink={canViewSystem}
        >
          <p>
            Scan queues or workers may be unavailable. Counts below still
            reflect stored data; automated evidence may be stale until pipelines
            recover.
          </p>
        </RouteReliabilityNotice>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card space-y-4 lg:col-span-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Organization snapshot
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {opSummary.automationFreshnessNote}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-canvas))] p-3">
              <dt className="text-xs font-medium text-slate-500">
                Total findings
              </dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                {opSummary.totals.findings}
              </dd>
            </div>
            <div className="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-canvas))] p-3">
              <dt className="text-xs font-medium text-slate-500">Open</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                {opSummary.totals.open}
              </dd>
            </div>
            <div className="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-canvas))] p-3">
              <dt className="text-xs font-medium text-slate-500">Resolved</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                {opSummary.totals.resolved}
              </dd>
            </div>
            <div className="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-canvas))] p-3">
              <dt className="text-xs font-medium text-slate-500">
                Critical open
              </dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                {opSummary.totals.criticalOpen}
              </dd>
            </div>
            <div className="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-canvas))] p-3">
              <dt className="text-xs font-medium text-slate-500">
                Acknowledged
              </dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                {opSummary.totals.acknowledged}
              </dd>
            </div>
            <div className="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-canvas))] p-3">
              <dt className="text-xs font-medium text-slate-500">
                In progress
              </dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                {opSummary.totals.inProgress}
              </dd>
            </div>
            <div className="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-canvas))] p-3">
              <dt className="text-xs font-medium text-slate-500">Mitigated</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                {opSummary.totals.mitigated}
              </dd>
            </div>
            <div className="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-canvas))] p-3">
              <dt className="text-xs font-medium text-slate-500">
                Stale automated
              </dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                {opSummary.staleAutomationCount}
              </dd>
            </div>
          </dl>
          <div className="border-t border-[rgb(var(--color-border))] pt-4 text-sm text-slate-600">
            <p className="font-medium text-slate-900">Evidence source mix</p>
            <p className="mt-1">
              Automated (axe): {opSummary.evidenceSourceMix.automatedAxe} ·
              Manual review: {opSummary.evidenceSourceMix.manualReview} ·
              Imported: {opSummary.evidenceSourceMix.imported}
            </p>
          </div>
        </div>

        <div className="card flex flex-col">
          <h2 className="text-lg font-semibold text-slate-900">
            Generate export
          </h2>
          <form
            action={generateReportAction}
            className="mt-4 flex flex-1 flex-col space-y-4"
          >
            <div>
              <label htmlFor="report-site" className="label">
                Site
              </label>
              <select id="report-site" name="siteId" className="input">
                <option value="">All sites</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name} ({site.domain})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="report-format" className="label">
                Format
              </label>
              <select id="report-format" name="format" className="input">
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
              </select>
            </div>
            <div className="flex-1" />
            <button type="submit" className="btn-primary w-full">
              Generate report
            </button>
          </form>
          <p className="mt-4 text-xs leading-relaxed text-slate-500 border-t border-[rgb(var(--color-border))] pt-4">
            Exports document testing and remediation activity. They are not a
            legal guarantee of WCAG conformance; some success criteria require
            expert manual review.
          </p>
        </div>
      </div>
    </div>
  );
}
