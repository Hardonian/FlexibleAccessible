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
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import { generateVpatReport } from "@/lib/vpat/generator";
import { VpatInteractiveHub } from "@/components/compliance/vpat-interactive-hub";

export const metadata = { title: pageTitle("Reports") };

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ report_error?: string }>;
}) {
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  const params = await searchParams;
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
        <PageHeader title="Evidence reports" />
        <RouteReliabilityNotice variant="error" title="Reports require a working database" showSystemLink={canViewSystem}>
          <p>Report data cannot be loaded until core data services are healthy.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Evidence reports" />
        <RouteReliabilityNotice variant="error" title="Could not verify organization" showSystemLink={canViewSystem}>
          <p>{orgRes.message}</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "none") {
    return (
      <div className="space-y-6">
        <PageHeader title="Evidence reports" />
        <RouteReliabilityNotice variant="info" title="No organization membership">
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
        <PageHeader title="Evidence reports" />
        <RouteReliabilityNotice variant="error" title="Could not load report summary" showSystemLink={canViewSystem}>
          <p>{statsResult.message}</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const { opSummary, sites } = statsResult.data;

  let initialVpat: any = null;
  if (sites.length > 0) {
    try {
      initialVpat = await generateVpatReport(sites[0].id, orgRes.organizationId);
    } catch {
      // Degraded or no data
    }
  }

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        title="Evidence reports"
        description="Export structured findings data for audits, tickets, and stakeholder updates. This is evidence of testing activity — not a legal conformance certificate."
      />

      {reportError && (
        <RouteReliabilityNotice variant="error" title="Report generation failed">
          <p>{reportError}</p>
        </RouteReliabilityNotice>
      )}

      {!platformTruth.flags.jobPipelinesHealthy && (
        <RouteReliabilityNotice variant="warning" title="Background pipelines degraded" showSystemLink={canViewSystem}>
          <p>
            Scan queues or workers may be unavailable. Counts below still reflect stored data;
            automated evidence may be stale until pipelines recover.
          </p>
        </RouteReliabilityNotice>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left: organization snapshot ───────────────────────────────── */}
        <div className="space-y-5 lg:col-span-2">
          {/* KPI metrics grid */}
          <section aria-labelledby="snapshot-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="snapshot-heading" className="section-heading">Organization snapshot</h2>
              <p className="text-xs text-slate-500">{opSummary.automationFreshnessNote}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiTile label="Total findings" value={opSummary.totals.findings} icon={FileText} />
              <KpiTile label="Open" value={opSummary.totals.open} icon={AlertTriangle} accent="critical" />
              <KpiTile label="Resolved" value={opSummary.totals.resolved} icon={CheckCircle} accent="success" />
              <KpiTile label="Critical open" value={opSummary.totals.criticalOpen} icon={AlertTriangle} accent="critical" />
              <KpiTile label="Acknowledged" value={opSummary.totals.acknowledged} icon={Clock} />
              <KpiTile label="In progress" value={opSummary.totals.inProgress} icon={RefreshCw} accent="brand" />
              <KpiTile label="Mitigated" value={opSummary.totals.mitigated} icon={CheckCircle} accent="success" />
              <KpiTile label="Stale automated" value={opSummary.staleAutomationCount} icon={Clock} accent={opSummary.staleAutomationCount > 0 ? "warning" : undefined} />
            </dl>
          </section>

          {/* Evidence source mix */}
          <section className="card" aria-labelledby="source-mix-heading">
            <h2 id="source-mix-heading" className="section-heading mb-3">Evidence source mix</h2>
            <div className="flex flex-wrap gap-3">
              <SourceChip label="Automated (axe)" value={opSummary.evidenceSourceMix.automatedAxe} />
              <SourceChip label="Manual review" value={opSummary.evidenceSourceMix.manualReview} />
              <SourceChip label="Imported" value={opSummary.evidenceSourceMix.imported} />
            </div>
          </section>

          {/* Recurrence + review pressure */}
          <div className="grid gap-4 md:grid-cols-2">
            <section className="card space-y-3" aria-labelledby="recurrence-heading">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100" aria-hidden="true">
                  <TrendingUp className="h-3.5 w-3.5 text-slate-500" />
                </span>
                <h2 id="recurrence-heading" className="section-heading">Recurrence intelligence</h2>
              </div>
              <p className="text-xs text-slate-500">
                Repeated fingerprints and regression signals across completed scan runs.
              </p>
              <dl className="space-y-2">
                <RecurrenceRow label="Recurring across runs" value={opSummary.recurrence.recurringAcrossScanRuns} />
                <RecurrenceRow label="Regressed and open" value={opSummary.recurrence.regressedOpenFindings} accent="warning" />
                <RecurrenceRow label="Improved open backlog" value={opSummary.recurrence.improvedOpenBacklog} />
              </dl>
            </section>

            <section className="card space-y-3" aria-labelledby="review-pressure-heading">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100" aria-hidden="true">
                  <Users className="h-3.5 w-3.5 text-slate-500" />
                </span>
                <h2 id="review-pressure-heading" className="section-heading">Review queue pressure</h2>
              </div>
              <p className="text-xs text-slate-500">
                Deterministic from unresolved review tasks for this organization.
              </p>
              <dl className="space-y-2">
                <RecurrenceRow label="Unresolved reviews" value={opSummary.reviewQueue.unresolved} />
                <RecurrenceRow label="Overdue (>72h)" value={opSummary.reviewQueue.overdue72h} accent={opSummary.reviewQueue.overdue72h > 0 ? "warning" : undefined} />
                <RecurrenceRow label="Manual audit pending" value={opSummary.reviewQueue.manualAuditPending} />
              </dl>
            </section>
          </div>

          {/* Hotspots */}
          <section className="card" aria-labelledby="hotspots-heading">
            <h2 id="hotspots-heading" className="section-heading mb-3">Top recurring rule hotspots</h2>
            {opSummary.recurrence.topRecurringRuleHotspots.length === 0 ? (
              <p className="text-sm text-slate-500">No recurring scan-run hotspots yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100" role="list">
                {opSummary.recurrence.topRecurringRuleHotspots.map((row) => (
                  <li key={row.ruleId} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                    <span className="font-mono text-xs text-slate-700 truncate">{row.ruleId}</span>
                    <div className="flex shrink-0 gap-3 text-xs">
                      <span className="text-slate-500">
                        <span className="font-semibold tabular-nums text-slate-900">{row.recurringFindings}</span> recurring
                      </span>
                      <span className="text-slate-500">
                        <span className="font-semibold tabular-nums text-red-800">{row.criticalOpenFindings}</span> critical open
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ── Right: export form ─────────────────────────────────────────── */}
        <div className="card flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50" aria-hidden="true">
              <FileText className="h-4 w-4 text-brand-600" />
            </span>
            <h2 className="section-heading">Generate export</h2>
          </div>
          <form action={generateReportAction} className="flex flex-1 flex-col space-y-4">
            <div>
              <label htmlFor="report-site" className="label">Site</label>
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
              <label htmlFor="report-format" className="label">Format</label>
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
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs leading-relaxed text-slate-500">
              Exports document testing and remediation activity. They are not a legal guarantee
              of WCAG conformance; some success criteria require expert manual review.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive WCAG 2.2 VPAT Hub */}
      <VpatInteractiveHub
        initialReport={initialVpat}
        sites={sites}
        currentSiteId={sites[0]?.id ?? ""}
        organizationId={orgRes.organizationId}
      />
    </div>
  );
}

function KpiTile({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  accent?: "critical" | "warning" | "success" | "brand";
}) {
  const accentStyles = {
    critical: { border: "border-l-red-400",    icon: "bg-red-50 text-red-500",      value: "text-red-900"      },
    warning:  { border: "border-l-amber-400",  icon: "bg-amber-50 text-amber-500",  value: "text-amber-900"    },
    success:  { border: "border-l-emerald-400",icon: "bg-emerald-50 text-emerald-500",value: "text-emerald-900" },
    brand:    { border: "border-l-brand-400",  icon: "bg-brand-50 text-brand-600",  value: "text-brand-900"    },
  };
  const style = accent ? accentStyles[accent] : null;

  return (
    <div
      className={`rounded-xl border bg-white p-3 shadow-[0_1px_2px_0_rgb(15_23_42/0.04)] ${
        style ? `border-l-4 border-slate-200 ${style.border}` : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${style?.icon ?? "bg-slate-100 text-slate-400"}`} aria-hidden="true">
          <Icon className="h-3.5 w-3.5" aria-hidden={true} />
        </span>
      </div>
      <dd className={`mt-1 text-2xl font-bold tabular-nums ${style?.value ?? "text-slate-900"}`}>
        {value.toLocaleString()}
      </dd>
    </div>
  );
}

function SourceChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="text-sm font-bold tabular-nums text-slate-900">{value.toLocaleString()}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

function RecurrenceRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "warning";
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd
        className={`text-sm font-semibold tabular-nums ${
          accent === "warning" && value > 0 ? "text-amber-800" : "text-slate-900"
        }`}
      >
        {value.toLocaleString()}
      </dd>
    </div>
  );
}
