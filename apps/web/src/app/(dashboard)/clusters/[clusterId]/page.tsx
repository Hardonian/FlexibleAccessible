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
        <h1 className="text-2xl font-bold text-slate-900">Cluster Details</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Cluster details require a working database"
        >
          <p>
            Cluster information cannot be loaded until core data services are
            healthy.
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "error") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Cluster Details</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Could not verify organization"
        >
          <p>{orgRes.message}</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "none") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Cluster Details</h1>
        <RouteReliabilityNotice
          variant="info"
          title="No organization membership"
        >
          <p>You need an organization to view clusters.</p>
        </RouteReliabilityNotice>
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

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <Link href="/clusters" className="hover:text-brand-600">
            Clusters
          </Link>
          <span>/</span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`badge ${
              cluster.severity === "CRITICAL"
                ? "badge-critical"
                : cluster.severity === "SERIOUS"
                  ? "badge-serious"
                  : cluster.severity === "MODERATE"
                    ? "badge-moderate"
                    : "badge-minor"
            }`}
          >
            {cluster.severity.toLowerCase()}
          </span>
          <h1 className="text-2xl font-bold text-slate-900">{cluster.name}</h1>
        </div>
        {cluster.description && (
          <p className="text-slate-500 mt-2">{cluster.description}</p>
        )}
      </div>

      <div className="card grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-slate-500 uppercase">Pages Affected</p>
          <p className="text-2xl font-bold text-slate-900">
            {cluster.pageCount}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase">Findings</p>
          <p className="text-2xl font-bold text-slate-900">
            {cluster.findingCount}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase">Site</p>
          <p className="text-sm font-medium text-slate-900 mt-1">
            {cluster.site.name}
          </p>
        </div>
      </div>

      {cluster.selectorPattern && (
        <div className="card">
          <h2 className="text-sm font-medium text-slate-500 mb-2">
            Component Pattern
          </h2>
          <code className="block bg-slate-100 rounded-lg p-3 text-sm text-slate-800 overflow-x-auto">
            {cluster.selectorPattern}
          </code>
          {cluster.domFingerprint && (
            <p className="text-xs text-slate-400 mt-2">
              DOM Fingerprint: {cluster.domFingerprint}
            </p>
          )}
        </div>
      )}

      {/* Suggestions */}
      {cluster.suggestions.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Remediation Suggestions ({cluster.suggestions.length})
          </h2>
          <div className="space-y-4">
            {cluster.suggestions.map(
              (s: (typeof cluster.suggestions)[number]) => (
                <div
                  key={s.id}
                  className="border border-slate-200 rounded-lg p-4"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="badge bg-blue-100 text-blue-800">
                      {s.type.toLowerCase().replace("_", " ")}
                    </span>
                    <span className="text-sm text-slate-500">
                      {Math.round(s.confidence * 100)}% confidence
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-3">{s.rationale}</p>
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
                    className="btn-secondary text-xs mt-3 inline-flex"
                  >
                    Review & Export
                  </Link>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {/* Findings in this cluster */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Related Findings ({cluster.findings.length})
        </h2>
        {cluster.findings.length === 0 ? (
          <p className="text-sm text-slate-500">
            No findings assigned to this cluster yet.
          </p>
        ) : (
          <ul className="space-y-2" role="list">
            {cluster.findings.map((f: (typeof cluster.findings)[number]) => (
              <li key={f.id}>
                <Link
                  href={`/findings/${f.id}`}
                  className="flex items-center justify-between py-2 border-b border-slate-100 hover:bg-slate-50 px-2 rounded"
                >
                  <div>
                    <span className="text-sm font-medium text-slate-900">
                      {f.description}
                    </span>
                    <span className="text-xs text-slate-400 ml-2">
                      {f.ruleId}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {f._count.occurrences} occurrences
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
