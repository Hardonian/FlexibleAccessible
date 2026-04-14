import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import {
  resolveDashboardOrgMembership,
  runOrgScopedQuery,
} from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { EmptyState, MetricCard } from "@aros/ui";
import { PageHeader } from "@/components/layout/page-header";
import { pageTitle } from "@/lib/product-brand";
import { FileSearch } from "lucide-react";

export const metadata = { title: pageTitle("Cluster Detail") };

export default async function ClusterDetailPage({
  params,
}: {
  params: Promise<{ clusterId: string }>;
}) {
  const { clusterId } = await params;
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();

  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind === "platform_blocked") {
    return (
      <div className="space-y-6">
        <PageHeader title="Cluster details" />
        <RouteReliabilityNotice
          variant="error"
          title="Cluster details require a working database"
        >
          <p>
            Cluster information cannot be loaded until core data services are
            healthy.
          </p>
        </RouteReliabilityNotice>
        <Link href="/clusters" className="btn-secondary text-sm">
          Back to clusters
        </Link>
      </div>
    );
  }

  if (orgRes.kind === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Cluster details" />
        <RouteReliabilityNotice
          variant="error"
          title="Could not verify organization"
        >
          <p>{orgRes.message}</p>
        </RouteReliabilityNotice>
        <Link href="/clusters" className="btn-secondary text-sm">
          Back to clusters
        </Link>
      </div>
    );
  }

  if (orgRes.kind === "none") {
    return (
      <div className="space-y-6">
        <PageHeader title="Cluster details" />
        <RouteReliabilityNotice
          variant="info"
          title="No organization membership"
        >
          <p>You need an organization to view clusters.</p>
        </RouteReliabilityNotice>
        <Link href="/clusters" className="btn-secondary text-sm">
          Back to clusters
        </Link>
      </div>
    );
  }

  const clusterResult = await runOrgScopedQuery(
    orgRes,
    async (organizationId) => {
      return prisma.issueCluster.findFirst({
        where: {
          id: clusterId,
          site: { workspace: { organizationId } },
        },
        include: {
          site: { select: { name: true, domain: true } },
          findings: {
            include: {
              _count: { select: { occurrences: true } },
            },
            orderBy: { occurrenceCount: "desc" },
            take: 50,
          },
          suggestions: {
            orderBy: { confidence: "desc" },
            take: 10,
          },
        },
      });
    },
  );

  if (!clusterResult.ok || !clusterResult.data) notFound();

  const cluster = clusterResult.data;

  const severityBadgeClass =
    cluster.severity === "CRITICAL"
      ? "badge-critical"
      : cluster.severity === "SERIOUS"
        ? "badge-serious"
        : cluster.severity === "MODERATE"
          ? "badge-moderate"
          : "badge-minor";

  const severityVariant =
    cluster.severity === "CRITICAL"
      ? "critical"
      : cluster.severity === "SERIOUS"
        ? "warning"
        : cluster.severity === "MODERATE"
          ? "warning"
          : "neutral";

  return (
    <div className="space-y-6">
      <div>
        <nav className="flex items-center gap-2 text-sm text-slate-500 mb-2" aria-label="Breadcrumb">
          <Link href="/clusters" className="hover:text-brand-600 transition-colors">
            Clusters
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-slate-900 font-medium truncate max-w-xs">{cluster.name}</span>
        </nav>
        <PageHeader title={cluster.name} description={cluster.description ?? undefined}>
          <span className={`badge ${severityBadgeClass}`}>
            {cluster.severity.toLowerCase()}
          </span>
        </PageHeader>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Pages affected"
          value={cluster.pageCount}
          variant={severityVariant as "critical" | "warning" | "neutral"}
          accent
        />
        <MetricCard label="Findings" value={cluster.findingCount} variant="default" />
        <MetricCard label="Site" value={cluster.site.name} variant="default" />
      </div>

      {cluster.selectorPattern && (
        <div className="card">
          <h2 className="text-sm font-medium text-slate-500 mb-2">
            Component pattern
          </h2>
          <code className="block bg-slate-100 rounded-lg p-3 text-sm text-slate-800 overflow-x-auto">
            {cluster.selectorPattern}
          </code>
          {cluster.domFingerprint && (
            <p className="text-xs text-slate-400 mt-2">
              DOM fingerprint: {cluster.domFingerprint}
            </p>
          )}
        </div>
      )}

      {cluster.suggestions.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Remediation suggestions ({cluster.suggestions.length})
          </h2>
          <div className="space-y-4">
            {cluster.suggestions.map(
              (s: (typeof cluster.suggestions)[number]) => {
                const confidencePct = Math.round(s.confidence * 100);
                const confColor =
                  confidencePct >= 70
                    ? "bg-emerald-400"
                    : confidencePct >= 40
                      ? "bg-amber-400"
                      : "bg-red-400";
                return (
                  <div
                    key={s.id}
                    className="rounded-lg border border-slate-200 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="badge bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200">
                        {s.type.toLowerCase().replace("_", " ")}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums text-slate-900">
                          {confidencePct}%
                        </span>
                        <div
                          className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"
                          role="meter"
                          aria-label={`${confidencePct}% confidence`}
                          aria-valuenow={confidencePct}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >
                          <div
                            className={`h-full rounded-full ${confColor}`}
                            style={{ width: `${confidencePct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600">{s.rationale}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Before</p>
                        <pre className="bg-red-50 rounded p-2 text-xs overflow-x-auto">
                          <code>{s.originalCode}</code>
                        </pre>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">After</p>
                        <pre className="bg-green-50 rounded p-2 text-xs overflow-x-auto">
                          <code>{s.suggestedCode}</code>
                        </pre>
                      </div>
                    </div>
                    <Link
                      href={`/remediation/${s.id}`}
                      className="btn-secondary text-xs inline-flex"
                    >
                      Review &amp; export
                    </Link>
                  </div>
                );
              },
            )}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Related findings ({cluster.findings.length})
        </h2>
        {cluster.findings.length === 0 ? (
          <EmptyState
            icon={FileSearch}
            title="No findings assigned yet"
            description="Findings will appear here once they are linked to this cluster."
          />
        ) : (
          <ul className="space-y-1" role="list">
            {cluster.findings.map((f: (typeof cluster.findings)[number]) => (
              <li key={f.id}>
                <Link
                  href={`/findings/${f.id}`}
                  className="group flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-slate-900 group-hover:text-brand-700 transition-colors truncate block">
                      {f.description}
                    </span>
                    <span className="text-xs text-slate-400">{f.ruleId}</span>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500 ml-3">
                    {f._count.occurrences} occurrence{f._count.occurrences !== 1 ? "s" : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
