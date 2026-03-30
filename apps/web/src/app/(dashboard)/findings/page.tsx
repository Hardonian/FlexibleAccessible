import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import type { Prisma, Severity, FindingStatus, EvidenceSource } from "@aros/db";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import {
  resolveDashboardOrgMembership,
  runOrgScopedQuery,
} from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { hasPermission } from "@aros/config";

type FindingListRow = Prisma.CanonicalFindingGetPayload<{
  include: {
    _count: { select: { occurrences: true } };
    cluster: { select: { id: true; name: true } };
    site: { select: { id: true; name: true; domain: true } };
  };
}>;

export const metadata = { title: "Findings - AROS" };

interface SearchParams {
  page?: string;
  severity?: string;
  status?: string;
  siteId?: string;
  ruleId?: string;
  evidenceSource?: string;
}

export default async function FindingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireSession();
  const params = await searchParams;
  const platformTruth = await getRoutePlatformTruth();
  const canViewSystem = await prisma.membership
    .findMany({ where: { userId: user.id }, select: { role: true } })
    .then((rows) => rows.some((m) => hasPermission(m.role, "org:system:view")))
    .catch(() => false);

  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind === "platform_blocked") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Findings</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Findings require a working database"
          showSystemLink={canViewSystem}
        >
          <p>
            Findings cannot be loaded until core data services are healthy. See
            the banner above for status.
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "error") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Findings</h1>
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
        <h1 className="text-2xl font-bold text-slate-900">Findings</h1>
        <RouteReliabilityNotice
          variant="info"
          title="No organization membership"
        >
          <p>You need to belong to an organization to view findings.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const page = parseInt(params.page ?? "1", 10);
  const limit = 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    occurrences: {
      some: {
        page: {
          site: { workspace: { organizationId: orgRes.organizationId } },
          ...(params.siteId ? { siteId: params.siteId } : {}),
        },
      },
    },
  };

  if (params.severity) {
    where.impact = params.severity as Severity;
  }
  if (params.status) {
    where.status = params.status as FindingStatus;
  }
  if (params.ruleId) {
    where.ruleId = params.ruleId;
  }
  if (
    params.evidenceSource &&
    ["AUTOMATED_AXE", "MANUAL_REVIEW", "IMPORTED"].includes(
      params.evidenceSource,
    )
  ) {
    where.evidenceSource = params.evidenceSource as EvidenceSource;
  }

  const listResult = await runOrgScopedQuery(orgRes, async () => {
    const [findings, total] = await Promise.all([
      prisma.canonicalFinding.findMany({
        where,
        orderBy: [{ impact: "asc" }, { occurrenceCount: "desc" }],
        skip,
        take: limit,
        include: {
          _count: { select: { occurrences: true } },
          cluster: { select: { id: true, name: true } },
          site: { select: { id: true, name: true, domain: true } },
        },
      }),
      prisma.canonicalFinding.count({ where }),
    ]);
    return { findings, total };
  });

  if (!listResult.ok) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Findings</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Findings list unavailable"
          showSystemLink={canViewSystem}
        >
          <p>
            Could not load findings from the database ({listResult.message}).
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const { findings, total } = listResult.data;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Findings</h1>
          <p className="text-slate-500 mt-1">
            {total} deduplicated finding{total === 1 ? "" : "s"} in your
            organization (not a legal conformance score).
          </p>
        </div>
      </div>

      <div className="card">
        <form className="flex flex-wrap gap-4" method="GET">
          <div>
            <label htmlFor="severity-filter" className="label">
              Severity
            </label>
            <select
              id="severity-filter"
              name="severity"
              className="input"
              defaultValue={params.severity ?? ""}
            >
              <option value="">All</option>
              <option value="CRITICAL">Critical</option>
              <option value="SERIOUS">Serious</option>
              <option value="MODERATE">Moderate</option>
              <option value="MINOR">Minor</option>
            </select>
          </div>
          <div>
            <label htmlFor="status-filter" className="label">
              Status
            </label>
            <select
              id="status-filter"
              name="status"
              className="input"
              defaultValue={params.status ?? ""}
            >
              <option value="">All</option>
              <option value="OPEN">Open</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="MITIGATED">Mitigated</option>
              <option value="FALSE_POSITIVE">False positive</option>
              <option value="WONT_FIX">Won&apos;t fix / accepted risk</option>
            </select>
          </div>
          <div>
            <label htmlFor="source-filter" className="label">
              Evidence source
            </label>
            <select
              id="source-filter"
              name="evidenceSource"
              className="input"
              defaultValue={params.evidenceSource ?? ""}
            >
              <option value="">All</option>
              <option value="AUTOMATED_AXE">Automated (axe)</option>
              <option value="MANUAL_REVIEW">Manual review</option>
              <option value="IMPORTED">Imported</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-secondary">
              Filter
            </button>
          </div>
        </form>
      </div>

      {findings.length === 0 ? (
        <div className="card text-center py-12 space-y-2">
          <p className="text-slate-700 font-medium">
            No findings match your filters
          </p>
          <p className="text-sm text-slate-500">
            {total === 0
              ? "There are no findings for this organization yet, or none match the selected filters."
              : "Try clearing filters or changing the page."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {findings.map((finding) => (
            <FindingRow key={finding.id} finding={finding} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav
          className="flex items-center justify-center gap-2"
          aria-label="Pagination"
        >
          {page > 1 && (
            <Link
              href={`/findings?page=${page - 1}&severity=${params.severity ?? ""}&status=${params.status ?? ""}&evidenceSource=${params.evidenceSource ?? ""}`}
              className="btn-secondary text-sm"
              aria-label={`Previous page, page ${page - 1} of ${totalPages}`}
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-slate-500" aria-current="page">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/findings?page=${page + 1}&severity=${params.severity ?? ""}&status=${params.status ?? ""}&evidenceSource=${params.evidenceSource ?? ""}`}
              className="btn-secondary text-sm"
              aria-label={`Next page, page ${page + 1} of ${totalPages}`}
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

function FindingRow({ finding }: { finding: FindingListRow }) {
  const freshness = deriveFindingFreshness(finding);
  return (
    <Link
      href={`/findings/${finding.id}`}
      className="card hover:shadow-md transition-shadow block"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`badge ${
                finding.impact === "CRITICAL"
                  ? "badge-critical"
                  : finding.impact === "SERIOUS"
                    ? "badge-serious"
                    : finding.impact === "MODERATE"
                      ? "badge-moderate"
                      : "badge-minor"
              }`}
            >
              {finding.impact.toLowerCase()}
            </span>
            <span className="text-xs text-slate-400">{finding.ruleId}</span>
            <EvidenceSourceBadge source={finding.evidenceSource} />
            {freshness === "stale" && (
              <span
                className="badge bg-amber-50 text-amber-700 border border-amber-200"
                title="Newer scan data exists but this finding has not been re-verified"
              >
                stale
              </span>
            )}
            {finding.cluster && (
              <span className="badge bg-purple-100 text-purple-800">
                {finding.cluster.name}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-900">
            {finding.description}
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
            <span>{finding._count.occurrences} occurrences</span>
            <span>Site: {finding.site.name}</span>
            <span>First seen: {finding.firstSeenAt.toLocaleDateString()}</span>
            {finding.lastVerifiedAt && (
              <span>
                Last verified: {finding.lastVerifiedAt.toLocaleDateString()}
              </span>
            )}
            {finding.wcagTags.length > 0 && (
              <span>WCAG: {finding.wcagTags.join(", ")}</span>
            )}
          </div>
        </div>
        <div>
          <StatusBadge status={finding.status} />
        </div>
      </div>
    </Link>
  );
}

function deriveFindingFreshness(finding: {
  lastVerifiedAt: Date | null;
  lastSeenAt: Date;
  evidenceSource: string;
}): "current" | "stale" | "unknown" {
  if (finding.evidenceSource !== "AUTOMATED_AXE") return "unknown";
  if (!finding.lastVerifiedAt) return "stale";
  const daysSinceVerified =
    (Date.now() - finding.lastVerifiedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceVerified > 30) return "stale";
  return "current";
}

function EvidenceSourceBadge({ source }: { source: string }) {
  const label =
    source === "AUTOMATED_AXE"
      ? "Automated"
      : source === "MANUAL_REVIEW"
        ? "Manual"
        : source === "IMPORTED"
          ? "Imported"
          : source;
  return (
    <span
      className="text-xs rounded px-1.5 py-0.5 bg-slate-100 text-slate-600"
      title="How this finding entered the system"
    >
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    OPEN: "bg-red-100 text-red-800",
    ACKNOWLEDGED: "bg-amber-100 text-amber-900",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    RESOLVED: "bg-green-100 text-green-800",
    MITIGATED: "bg-emerald-100 text-emerald-900",
    WONT_FIX: "bg-slate-100 text-slate-600",
    FALSE_POSITIVE: "bg-slate-100 text-slate-600",
  };
  return (
    <span
      className={`badge ${styles[status] ?? "bg-slate-100 text-slate-800"}`}
    >
      {status.toLowerCase().replace("_", " ")}
    </span>
  );
}
