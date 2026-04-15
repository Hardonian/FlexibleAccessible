import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { ArrowRight, Globe, Minus, Plus, TrendingDown } from "lucide-react";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import {
  resolveDashboardOrgMembership,
  runOrgScopedQuery,
} from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { hasPermission } from "@aros/config";
import { EmptyState, MetricCard } from "@aros/ui";
import { PageHeader } from "@/components/layout/page-header";
import { pageTitle } from "@/lib/product-brand";
import {
  rollupSiteOperations,
  summarizeSiteOperations,
  type SiteOperationalStatus,
} from "@/lib/site-operations";
import { getEntitlementState } from "@/lib/auth-guard";
import { startCrawlAction } from "./[siteId]/actions";
import { scanSiteInitialState } from "./[siteId]/scan-action-state";
import { startSiteScanAction } from "./[siteId]/scan-actions";
import { ScanNowButton } from "./[siteId]/scan-now-button";
import { computeScanDelta } from "@/lib/scan-delta";

export const metadata = { title: pageTitle("Sites") };

export default async function SitesPage() {
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
        <PageHeader title="Sites" />
        <RouteReliabilityNotice variant="error" title="Sites require a working database" showSystemLink={canViewSystem}>
          <p>Site data cannot be loaded until core data services are healthy.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Sites" />
        <RouteReliabilityNotice variant="error" title="Could not verify organization" showSystemLink={canViewSystem}>
          <p>{orgRes.message}</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "none") {
    return (
      <div className="space-y-6">
        <PageHeader title="Sites" />
        <RouteReliabilityNotice variant="info" title="No organization membership">
          <p>You need an organization to manage sites.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const sitesResult = await runOrgScopedQuery(orgRes, async (orgId) => {
    const [sites, openFindingCounts, subscription] = await Promise.all([
      prisma.site.findMany({
        where: { workspace: { organizationId: orgId } },
        include: {
          workspace: { select: { name: true } },
          crawlConfig: { select: { scheduleCron: true } },
          scanRuns: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { id: true, status: true, completedAt: true, createdAt: true },
          },
          crawlRuns: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true },
          },
          _count: {
            select: { crawlRuns: true, pages: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.canonicalFinding.groupBy({
        by: ["siteId"],
        where: {
          site: { workspace: { organizationId: orgId } },
          status: "OPEN",
        },
        _count: { _all: true },
      }),
      prisma.subscription.findUnique({
        where: { organizationId: orgId },
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
      }),
    ]);
    return { sites, openFindingCounts, subscription };
  });

  if (!sitesResult.ok) {
    return (
      <div className="space-y-6">
        <PageHeader title="Sites" />
        <RouteReliabilityNotice variant="error" title="Could not load sites" showSystemLink={canViewSystem}>
          <p>{sitesResult.message}</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const { sites, openFindingCounts, subscription } = sitesResult.data;
  const openFindingsBySiteId = new Map<string, number>(
    openFindingCounts.map((row) => [row.siteId, row._count._all as number]),
  );
  const entitlement = getEntitlementState(subscription);

  const completedScanRunIds = sites.flatMap((site) =>
    site.scanRuns.filter((run) => run.status === "COMPLETED").slice(0, 2).map((run) => run.id),
  );

  const runFingerprints =
    completedScanRunIds.length > 0
      ? await prisma.rawViolation.findMany({
          where: { scanRunId: { in: completedScanRunIds } },
          select: { scanRunId: true, fingerprint: true },
          distinct: ["scanRunId", "fingerprint"],
        })
      : [];

  const fingerprintsByRunId = new Map<string, string[]>();
  for (const row of runFingerprints) {
    const bucket = fingerprintsByRunId.get(row.scanRunId) ?? [];
    bucket.push(row.fingerprint);
    fingerprintsByRunId.set(row.scanRunId, bucket);
  }

  const operationalSites = sites.map((site) => {
    const latestScan = site.scanRuns[0] ?? null;
    const latestCompleted = site.scanRuns.find((run) => run.status === "COMPLETED") ?? null;
    const priorCompleted = site.scanRuns.filter((run) => run.status === "COMPLETED").slice(1, 2)[0] ?? null;

    const ops = summarizeSiteOperations({
      pagesCount: site._count.pages,
      openFindings: openFindingsBySiteId.get(site.id) ?? 0,
      latestCrawlStatus: site.crawlRuns[0]?.status ?? null,
      latestScanStatus: latestScan?.status ?? null,
      latestScanCompletedAt: latestCompleted?.completedAt ?? null,
      scheduleCron: site.crawlConfig?.scheduleCron ?? null,
      entitlement,
      workerRunning: platformTruth.flags.workerRunning,
      jobPipelinesHealthy: platformTruth.flags.jobPipelinesHealthy,
    });

    const delta = latestCompleted
      ? computeScanDelta(
          fingerprintsByRunId.get(latestCompleted.id) ?? [],
          priorCompleted ? (fingerprintsByRunId.get(priorCompleted.id) ?? []) : null,
        )
      : { comparable: false, newCount: 0, resolvedCount: 0, persistingCount: 0 };

    const scanBlocked = latestScan?.status === "PENDING" || latestScan?.status === "RUNNING";

    return { ...site, openFindings: openFindingsBySiteId.get(site.id) ?? 0, ops, delta, scanBlocked };
  });

  const opsRollup = rollupSiteOperations(operationalSites.map((site) => site.ops.status));

  const deltaRollup = operationalSites.reduce(
    (acc, site) => {
      acc.newCount += site.delta.newCount;
      acc.resolvedCount += site.delta.resolvedCount;
      acc.persistingCount += site.delta.persistingCount;
      if (site.delta.comparable) acc.comparableSites += 1;
      return acc;
    },
    { newCount: 0, resolvedCount: 0, persistingCount: 0, comparableSites: 0 },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sites"
        description="Targets you crawl and verify. Add production and staging separately when they differ."
      >
        <Link href="/sites/new" className="btn-primary w-full sm:w-auto">
          Add site
        </Link>
      </PageHeader>

      {sites.length === 0 ? (
        <EmptyState
          icon={Globe}
          variant="brand"
          title="No sites yet"
          description="Add your first website to start scanning for accessibility issues."
          action={
            <Link href="/sites/new" className="btn-primary">
              Add Your First Site
            </Link>
          }
          className="card"
        />
      ) : (
        <>
          {/* ── Operator worklist ──────────────────────────────────────── */}
          <section aria-labelledby="ops-worklist-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="ops-worklist-heading" className="section-heading">Operator worklist</h2>
              <p className="text-xs text-slate-500">
                Derived from crawl/scan freshness and platform readiness
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <MetricCard
                label="Needs activation"
                value={opsRollup.activationRequired}
                variant={opsRollup.activationRequired > 0 ? "warning" : "neutral"}
                as="div"
              />
              <MetricCard
                label="Scan failures"
                value={opsRollup.scanAttentionRequired}
                variant={opsRollup.scanAttentionRequired > 0 ? "critical" : "neutral"}
                as="div"
              />
              <MetricCard
                label="Automation degraded"
                value={opsRollup.automationDegraded}
                variant={opsRollup.automationDegraded > 0 ? "warning" : "neutral"}
                as="div"
              />
              <MetricCard
                label="Evidence stale"
                value={opsRollup.evidenceStale}
                variant={opsRollup.evidenceStale > 0 ? "warning" : "neutral"}
                as="div"
              />
              <MetricCard
                label="Healthy"
                value={opsRollup.healthy}
                variant={opsRollup.healthy > 0 ? "success" : "neutral"}
                as="div"
              />
            </dl>
          </section>

          {/* ── Scan delta summary ─────────────────────────────────────── */}
          <section className="card" aria-labelledby="scan-delta-heading">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 id="scan-delta-heading" className="section-heading">Changed since last completed scan</h2>
              <p className="text-xs text-slate-500">
                {deltaRollup.comparableSites}/{operationalSites.length} sites comparable
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-lg border border-l-4 border-slate-200 border-l-red-400 bg-white px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-50" aria-hidden="true">
                  <Plus className="h-4 w-4 text-red-600" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">New violations</p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-red-900">{deltaRollup.newCount.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-l-4 border-slate-200 border-l-emerald-400 bg-white px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50" aria-hidden="true">
                  <TrendingDown className="h-4 w-4 text-emerald-600" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Resolved</p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-emerald-900">{deltaRollup.resolvedCount.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-l-4 border-slate-200 border-l-slate-400 bg-white px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100" aria-hidden="true">
                  <Minus className="h-4 w-4 text-slate-500" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Persisting</p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">{deltaRollup.persistingCount.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </section>

          {/* ── Site cards ─────────────────────────────────────────────── */}
          <div className="grid gap-4">
            {operationalSites.map((site) => (
              <article
                key={site.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_0_rgb(15_23_42/0.06)] transition-shadow hover:shadow-[0_4px_8px_-2px_rgb(15_23_42/0.10)]"
              >
                {/* Site header */}
                <div className="flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <EnvironmentBadge environment={site.environment} />
                      <span className="text-xs text-slate-400">{site.workspace.name}</span>
                    </div>
                    <h3 className="mt-1 font-semibold text-slate-900">
                      <Link
                        href={`/sites/${site.id}`}
                        className="hover:text-brand-700 transition-colors focus:outline-none focus-visible:text-brand-700"
                      >
                        {site.name}
                      </Link>
                    </h3>
                    <p className="text-sm text-slate-500">{site.domain}</p>
                  </div>
                  <StatusPill status={site.ops.status} label={site.ops.statusLabel} />
                </div>

                {/* Status reason */}
                <p className="px-5 pt-2 text-xs text-slate-600">{site.ops.statusReason}</p>

                {/* Metrics strip */}
                <div className="mt-3 grid gap-px border-t border-slate-100 bg-slate-100 sm:grid-cols-4">
                  <SiteMetric label="Pages" value={String(site._count.pages)} />
                  <SiteMetric
                    label="Open findings"
                    value={String(site.openFindings)}
                    highlight={site.openFindings > 0 ? "warning" : undefined}
                  />
                  <SiteMetric label="Evidence freshness" value={site.ops.freshnessLabel} />
                  <SiteMetric label="Next scheduled run" value={site.ops.nextScheduledRunLabel} />
                </div>

                {/* Delta bar */}
                <div className="px-5 py-3 border-t border-slate-100" role="status">
                  {site.delta.comparable ? (
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <span className="text-slate-500 font-medium">Δ vs previous scan:</span>
                      <span className="font-semibold text-red-700">
                        +{site.delta.newCount} new
                      </span>
                      <span className="font-semibold text-emerald-700">
                        -{site.delta.resolvedCount} resolved
                      </span>
                      <span className="font-semibold text-slate-700">
                        {site.delta.persistingCount} persisting
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      No comparable baseline yet — need two completed scans.
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
                  <Link href={`/sites/${site.id}`} className="btn-secondary text-sm">
                    Open site
                  </Link>
                  <form action={startCrawlAction}>
                    <input type="hidden" name="siteId" value={site.id} />
                    <button type="submit" className="btn-secondary text-sm">Start crawl</button>
                  </form>
                  <div className="[&_button]:text-sm">
                    <ScanNowButton
                      action={startSiteScanAction}
                      initialState={scanSiteInitialState}
                      siteId={site.id}
                      disabled={site._count.pages === 0 || site.scanBlocked}
                      blockedHint={
                        site.scanBlocked
                          ? "Verification is already queued or running for this site."
                          : site._count.pages === 0
                            ? "Run a crawl first so there are pages to verify."
                            : null
                      }
                    />
                  </div>
                  <Link href={site.ops.nextAction.href as any} className="btn-primary text-sm ml-auto flex items-center gap-1.5">
                    {site.ops.nextAction.label}
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SiteMetric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "warning";
}) {
  return (
    <div className="bg-white px-4 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${highlight === "warning" ? "text-red-700" : "text-slate-900"}`}>
        {value}
      </p>
    </div>
  );
}

function StatusPill({ status, label }: { status: SiteOperationalStatus; label: string }) {
  const config: Record<SiteOperationalStatus, { dot: string; badge: string }> = {
    activation_required:   { dot: "bg-sky-500",     badge: "bg-sky-50 text-sky-800 ring-sky-200"       },
    scan_attention_required: { dot: "bg-red-500",   badge: "bg-red-50 text-red-800 ring-red-200"         },
    automation_degraded:   { dot: "bg-amber-500",   badge: "bg-amber-50 text-amber-800 ring-amber-200"   },
    evidence_stale:        { dot: "bg-violet-500",  badge: "bg-violet-50 text-violet-800 ring-violet-200"},
    healthy:               { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-800 ring-emerald-200"},
  };
  const { dot, badge } = config[status];

  return (
    <span className={`badge shrink-0 ring-1 ring-inset ${badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function EnvironmentBadge({ environment }: { environment: string }) {
  const configs: Record<string, { label: string; className: string }> = {
    PRODUCTION: { label: "Production", className: "bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-200" },
    STAGING:    { label: "Staging",    className: "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200"       },
    DEVELOPMENT:{ label: "Development",className: "bg-sky-50 text-sky-900 ring-1 ring-inset ring-sky-200"             },
  };
  const { label, className } = configs[environment] ?? { label: environment, className: "bg-slate-100 text-slate-600" };
  return <span className={`badge text-xs ${className}`}>{label}</span>;
}
