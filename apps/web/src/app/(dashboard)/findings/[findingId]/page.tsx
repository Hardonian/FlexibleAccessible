import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import type { Prisma } from '@aros/db';
import Link from 'next/link';
import { FindingStatusForm } from './finding-status-form';
import { getRoutePlatformTruth } from '@/lib/platform-truth-cache';
import { resolveDashboardOrgMembership } from '@/lib/route-data-boundary';
import { RouteReliabilityNotice } from '@/components/reliability/route-reliability-notice';
import { hasPermission } from '@aros/config';
import { deriveAutomationEvidenceFreshness } from '@aros/shared';

export default async function FindingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ findingId: string }>;
  searchParams: Promise<{ remediation?: string }>;
}) {
  const { findingId } = await params;
  const sp = await searchParams;
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  const canViewSystem = await prisma.membership
    .findMany({ where: { userId: user.id }, select: { role: true } })
    .then((rows) => rows.some((m) => hasPermission(m.role, 'org:system:view')))
    .catch(() => false);

  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind === 'platform_blocked') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Finding</h1>
        <RouteReliabilityNotice variant="error" title="Finding unavailable" showSystemLink={canViewSystem}>
          <p>This finding cannot be loaded while core data services are down.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === 'error' || orgRes.kind === 'none') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Finding</h1>
        <RouteReliabilityNotice variant="info" title="Access not available" showSystemLink={canViewSystem}>
          <p>
            {orgRes.kind === 'none'
              ? 'You need an organization membership to view findings.'
              : `Could not verify organization (${orgRes.message}).`}
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  type FindingDetail = Prisma.CanonicalFindingGetPayload<{
    include: {
      site: { select: { id: true; name: true; domain: true } };
      lastScanRun: { select: { id: true; status: true; completedAt: true; createdAt: true; errorMessage: true } };
      statusEvents: {
        orderBy: { createdAt: 'desc' };
        take: 25;
        include: { user: { select: { email: true; name: true } } };
      };
      occurrences: {
        include: {
          page: { select: { id: true; url: true; title: true } };
          lastRawViolation: {
            select: {
              id: true;
              createdAt: true;
              elementContext: true;
              scanRun: { select: { id: true; status: true; completedAt: true } };
            };
          };
        };
      };
      cluster: true;
      suggestions: true;
    };
  }>;

  let finding: FindingDetail | null = null;

  try {
    finding = await prisma.canonicalFinding.findFirst({
      where: {
        id: findingId,
        occurrences: {
          some: { page: { site: { workspace: { organizationId: orgRes.organizationId } } } },
        },
      },
      include: {
        site: { select: { id: true, name: true, domain: true } },
        lastScanRun: {
          select: { id: true, status: true, completedAt: true, createdAt: true, errorMessage: true },
        },
        statusEvents: {
          orderBy: { createdAt: 'desc' },
          take: 25,
          include: { user: { select: { email: true, name: true } } },
        },
        occurrences: {
          include: {
            page: { select: { id: true, url: true, title: true } },
            lastRawViolation: {
              select: {
                id: true,
                createdAt: true,
                elementContext: true,
                scanRun: { select: { id: true, status: true, completedAt: true } },
              },
            },
          },
          take: 50,
          orderBy: { lastSeenAt: 'desc' },
        },
        cluster: true,
        suggestions: {
          orderBy: { confidence: 'desc' },
          take: 5,
        },
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Database error';
    console.error('[finding detail] query failed', e);
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Finding</h1>
        <RouteReliabilityNotice variant="error" title="Could not load finding" showSystemLink={canViewSystem}>
          <p>{message}</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (!finding) notFound();

  const canManageFindings = hasPermission(orgRes.role, 'findings:manage');

  const latestCompleted = await prisma.scanRun.findFirst({
    where: {
      status: 'COMPLETED',
      completedAt: { not: null },
      site: { workspace: { organizationId: orgRes.organizationId } },
    },
    orderBy: { completedAt: 'desc' },
    select: { completedAt: true },
  });

  const automationFreshness =
    finding.evidenceSource === 'AUTOMATED_AXE'
      ? deriveAutomationEvidenceFreshness({
          lastVerifiedAt: finding.lastVerifiedAt,
          latestCompletedScanCompletedAt: latestCompleted?.completedAt ?? null,
          jobPipelinesHealthy: platformTruth.flags.jobPipelinesHealthy,
        })
      : null;

  const remediationError =
    sp.remediation === 'forbidden'
      ? 'You do not have permission to change remediation status.'
      : sp.remediation === 'invalid_transition'
        ? 'That status change is not allowed from the current state.'
        : sp.remediation === 'invalid_status'
          ? 'Unknown remediation status.'
          : sp.remediation === 'not_found'
            ? 'Finding not found in your organization.'
            : null;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <Link href="/findings" className="hover:text-brand-600">
            Findings
          </Link>
          <span>/</span>
        </div>
        {remediationError && (
          <RouteReliabilityNotice variant="warning" title="Remediation update not applied">
            <p>{remediationError}</p>
          </RouteReliabilityNotice>
        )}

        <div className="flex items-center gap-3">
          <span
            className={`badge ${
              finding.impact === 'CRITICAL'
                ? 'badge-critical'
                : finding.impact === 'SERIOUS'
                  ? 'badge-serious'
                  : finding.impact === 'MODERATE'
                    ? 'badge-moderate'
                    : 'badge-minor'
            }`}
          >
            {finding.impact.toLowerCase()}
          </span>
          <h1 className="text-2xl font-bold text-slate-900">{finding.description}</h1>
        </div>
      </div>

      <div className="card grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Rule</p>
          <p className="text-sm font-medium text-slate-900 mt-1">{finding.ruleId}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Site</p>
          <p className="text-sm font-medium text-slate-900 mt-1">{finding.site.name}</p>
          <p className="text-xs text-slate-500">{finding.site.domain}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">WCAG tags (from scanner)</p>
          <p className="text-sm font-medium text-slate-900 mt-1">{finding.wcagTags.join(', ') || 'None reported'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Occurrences</p>
          <p className="text-sm font-medium text-slate-900 mt-1">{finding.occurrenceCount}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Evidence source</p>
          <p className="text-sm font-medium text-slate-900 mt-1">
            {finding.evidenceSource === 'AUTOMATED_AXE'
              ? 'Automated (axe-core scan)'
              : finding.evidenceSource === 'MANUAL_REVIEW'
                ? 'Manual review'
                : 'Imported'}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Automation evidence</p>
          <p className="text-sm text-slate-700 mt-1">
            {finding.evidenceSource !== 'AUTOMATED_AXE' ? (
              <>This finding is not tied to automated axe runs. Stale/current labels apply to automated evidence only.</>
            ) : automationFreshness === 'current' ? (
              <>Last verified by scan at {finding.lastVerifiedAt?.toLocaleString() ?? 'unknown'}.</>
            ) : automationFreshness === 'stale_newer_scan_exists' ? (
              <>
                <span className="text-amber-800 font-medium">Stale:</span> a newer completed scan exists than{' '}
                {finding.lastVerifiedAt?.toLocaleString() ?? 'last verified time'}. Results may have changed.
              </>
            ) : automationFreshness === 'never_autoverified' ? (
              <>No automated verification timestamp on record.</>
            ) : automationFreshness === 'no_completed_scan' ? (
              <>No completed scan found for this organization yet.</>
            ) : (
              <>
                Job pipelines are degraded; treat automated evidence as potentially stale until workers recover.
              </>
            )}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Last scan run (stored link)</p>
          <p className="text-sm text-slate-700 mt-1">
            {finding.lastScanRun ? (
              <>
                {finding.lastScanRun.status}
                {finding.lastScanRun.completedAt
                  ? ` · completed ${finding.lastScanRun.completedAt.toLocaleString()}`
                  : ''}
                {finding.lastScanRun.errorMessage ? ` · ${finding.lastScanRun.errorMessage}` : ''}
              </>
            ) : (
              'Not linked to a scan run row'
            )}
          </p>
        </div>
        <div className="col-span-2 lg:col-span-4 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Remediation</p>
          <FindingStatusForm
            findingId={findingId}
            defaultValue={finding.status}
            canManage={canManageFindings}
            defaultNote={finding.statusNote}
          />
          <p className="text-xs text-slate-500 mt-2">
            Resolved/mitigated findings stay in history. If a later automated scan detects the same issue again, status
            reopens to Open unless marked false positive or won&apos;t fix. Operators should add a short note when closing
            or accepting risk.
          </p>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">What the platform knows</h2>
        <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
          <li>Rule id, severity from the scanner, and deduplicated occurrences per page.</li>
          <li>Remediation status you set (audited) and optional operator notes.</li>
          <li>We do not certify WCAG conformance; automated checks are incomplete by definition.</li>
        </ul>
      </div>

      {finding.helpUrl && (
        <div className="card">
          <p className="text-sm text-slate-600">
            <a href={finding.helpUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
              Learn more about this rule
            </a>
          </p>
        </div>
      )}

      {finding.cluster && (
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Component Cluster</h2>
          <Link href={`/clusters/${finding.cluster.id}`} className="text-brand-600 hover:text-brand-700 font-medium">
            {finding.cluster.name}
          </Link>
          <p className="text-sm text-slate-500 mt-1">{finding.cluster.description}</p>
        </div>
      )}

      {finding.suggestions.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Remediation Suggestions</h2>
          <div className="space-y-4">
            {finding.suggestions.map((suggestion) => (
              <div key={suggestion.id} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="badge bg-blue-100 text-blue-800">{suggestion.type.toLowerCase().replace('_', ' ')}</span>
                  <span className="text-sm text-slate-500">Confidence: {Math.round(suggestion.confidence * 100)}%</span>
                </div>
                <p className="text-sm text-slate-600 mb-3">{suggestion.rationale}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Original</p>
                    <pre className="bg-red-50 border border-red-200 rounded p-2 text-xs overflow-x-auto">
                      <code>{suggestion.originalCode}</code>
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Suggested Fix</p>
                    <pre className="bg-green-50 border border-green-200 rounded p-2 text-xs overflow-x-auto">
                      <code>{suggestion.suggestedCode}</code>
                    </pre>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link href={`/remediation/${suggestion.id}`} className="btn-secondary text-xs">
                    Review & Export
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Affected Pages ({finding.occurrences.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pb-2 text-left font-medium text-slate-500">Page</th>
                <th className="pb-2 text-left font-medium text-slate-500">Selector</th>
                <th className="pb-2 text-left font-medium text-slate-500">Evidence</th>
                <th className="pb-2 text-right font-medium text-slate-500">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {finding.occurrences.map((occ) => (
                <tr key={occ.id} className="border-b border-slate-100">
                  <td className="py-2">
                    <p className="font-medium text-slate-900">{occ.page.title ?? occ.page.url}</p>
                    <p className="text-xs text-slate-400">{occ.page.url}</p>
                  </td>
                  <td className="py-2">
                    <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                      {occ.selector.length > 60 ? occ.selector.slice(0, 60) + '...' : occ.selector}
                    </code>
                  </td>
                  <td className="py-2 text-slate-600 max-w-md">
                    {occ.lastRawViolation?.elementContext ? (
                      <span className="text-xs">{occ.lastRawViolation.elementContext}</span>
                    ) : (
                      <span className="text-xs text-slate-400">No failure summary stored for this occurrence</span>
                    )}
                  </td>
                  <td className="py-2 text-right text-slate-500">{occ.lastSeenAt.toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {finding.statusEvents.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Remediation history</h2>
          <ul className="space-y-2 text-sm">
            {finding.statusEvents.map((ev) => (
              <li key={ev.id} className="border-b border-slate-100 pb-2">
                <span className="text-slate-500">{ev.createdAt.toLocaleString()}</span>
                {' · '}
                <span className="font-medium text-slate-800">
                  {ev.fromStatus ?? '—'} → {ev.toStatus}
                </span>
                {ev.user && (
                  <span className="text-slate-500">
                    {' '}
                    ({ev.user.name ?? ev.user.email})
                  </span>
                )}
                {ev.note && <p className="text-slate-600 mt-1">{ev.note}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
