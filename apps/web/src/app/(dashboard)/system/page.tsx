import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { hasPermission } from '@aros/config';
import type { MemberRole } from '@aros/db';
import { redirect } from 'next/navigation';
import { getPlatformHealthPayload } from '@/lib/platform-health';
import { getRoutePlatformTruth } from '@/lib/platform-truth-cache';
import { RouteReliabilityNotice } from '@/components/reliability/route-reliability-notice';
import {
  IssueAcknowledgeButton,
  OperatorControlPlaneClient,
} from '@/components/system/operator-control-plane-client';
import { type JobQueueDepthSnapshot, type PlatformDiagnosticIssue } from '@aros/core-services';
import { getEntitlementState } from '@/lib/auth-guard';
import { PRODUCT_EVENT_ACTIONS } from '@/lib/product-events';


export const metadata = { title: 'System & services' };

const healthStateStyles: Record<string, string> = {
  running: 'bg-emerald-100 text-emerald-900',
  ready: 'bg-sky-100 text-sky-900',
  degraded: 'bg-amber-100 text-amber-900',
  failed: 'bg-red-100 text-red-900',
  unavailable: 'bg-slate-200 text-slate-800',
  misconfigured: 'bg-orange-100 text-orange-900',
  disabled: 'bg-slate-100 text-slate-600',
};

export default async function SystemPage() {
  const user = await requireSession();

  let membership: {
    organizationId: string;
    role: string;
    organization: { id: string; name: string; slug: string };
  } | null = null;
  let membershipError: string | null = null;

  try {
    membership = await prisma.membership.findFirst({
      where: { userId: user.id },
      include: { organization: { select: { id: true, name: true, slug: true } } },
    });
  } catch (e) {
    membershipError = e instanceof Error ? e.message : 'Database error';
    console.error('[system] membership load failed', e);
  }

  if (membershipError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">System & core services</h1>
        <RouteReliabilityNotice variant="error" title="Cannot verify access">
          <p>We could not load your organization membership ({membershipError}).</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="card text-center py-12">
        <h1 className="text-lg font-semibold text-slate-900">No organization</h1>
        <p className="text-slate-500 mt-2">You need an organization membership to view system status.</p>
      </div>
    );
  }

  if (!hasPermission(membership.role as MemberRole, 'org:system:view')) {
    redirect('/dashboard');
  }

  const orgId = membership.organizationId;
  const canRunOperatorActions = hasPermission(membership.role as MemberRole, 'org:system:manage');

  const platformTruth = await getRoutePlatformTruth().catch(() => null);

  let payload: Awaited<ReturnType<typeof getPlatformHealthPayload>> | null = null;
  let loadError: string | null = null;
  try {
    payload = await getPlatformHealthPayload(orgId, user.id);
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Failed to load platform health';
    console.error('[system] platform health failed', e);
  }

  const productDecisionActions = Object.values(PRODUCT_EVENT_ACTIONS);

  const [orgCommercialBrief, apiKeyCount, pendingInviteCount, recentProductEvents] =
    await Promise.all([
      prisma.organization
        .findUnique({
          where: { id: orgId },
          select: {
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
            _count: { select: { memberships: true, workspaces: true } },
          },
        })
        .catch(() => null),
      prisma.apiKey
        .count({ where: { organizationId: orgId, isActive: true } })
        .catch(() => 0),
      prisma.auditLog
        .count({
          where: { organizationId: orgId, action: 'member:invite_pending' },
        })
        .catch(() => 0),
      prisma.auditLog
        .findMany({
          where: { organizationId: orgId, action: { in: productDecisionActions } },
          orderBy: { createdAt: 'desc' },
          take: 15,
          select: { id: true, action: true, createdAt: true, userId: true },
        })
        .catch(() => []),
    ]);


  const summary = payload?.diagnostics.summary ?? null;
  const criticalIssueCount = summary?.criticalBlockers.length ?? 0;
  const recoverableIssueCount = summary?.recoverableIssues.length ?? 0;
  const warningIssueCount = summary?.warnings.length ?? 0;
  const optionalIssueCount = summary?.optionalUnavailable.length ?? 0;
  const unhealthyServiceCount =
    payload?.report.services.filter((svc) => !['running', 'ready', 'disabled'].includes(svc.healthState)).length ?? 0;

  const commercialEntitlement = getEntitlementState(orgCommercialBrief?.subscription ?? null);
  const seatsInUse = orgCommercialBrief?._count.memberships ?? 0;
  const seatCap = orgCommercialBrief?.subscription?.maxSeats ?? 1;
  const seatsAtCap = seatsInUse + pendingInviteCount >= seatCap;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">System & core services</h1>
        <p className="text-slate-500 mt-1">
          Live deployment status for {membership.organization.name}. Values are derived from connectivity checks, queue
          metrics, and worker heartbeats — not static placeholders.
        </p>
        <p className="mt-3 text-sm text-slate-600 max-w-3xl">
          <span className="font-medium text-slate-800">Deployment-managed</span> settings (secrets, DATABASE_URL,
          REDIS_URL, integration keys) are never editable here — only validated and summarized.{' '}
          <span className="font-medium text-slate-800">In-product</span> actions (recheck, acknowledgements, optional banner
          suppression) require the <span className="font-mono text-xs">org:system:manage</span> permission (owners and
          admins) and persist to platform audit logs for this organization.
        </p>
      </div>

      {platformTruth && platformTruth.shellBlocker !== 'none' && (
        <RouteReliabilityNotice variant="warning" title="Route-level platform summary">
          <p>
            Shell readiness: <span className="font-mono">{platformTruth.readiness}</span>. This page shows the full
            operator report when available.
          </p>
        </RouteReliabilityNotice>
      )}

      <section className="card space-y-4" aria-labelledby="commercial-readiness-heading">
        <div>
          <h2 id="commercial-readiness-heading" className="text-lg font-semibold text-slate-900">
            Customer org commercial readiness
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Snapshot for operator triage: billing posture, seat pressure, and recent product-decision audit events (not a
            CRM). Self-serve limits apply unless a written contract explicitly overrides them.
          </p>
        </div>
        {orgCommercialBrief ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Entitlement</p>
              <ul className="mt-2 space-y-1">
                <li>
                  Plan:{' '}
                  <span className="font-mono text-xs">{orgCommercialBrief.subscription?.plan ?? 'FREE'}</span>
                </li>
                <li>
                  Status:{' '}
                  <span className="font-mono text-xs">
                    {orgCommercialBrief.subscription?.status ?? 'UNKNOWN'}
                  </span>
                </li>
                <li>
                  Paid access (server model):{' '}
                  <span className="font-medium">{commercialEntitlement.hasPaidAccess ? 'Yes' : 'No'}</span>
                  {commercialEntitlement.reason !== 'active_paid' && (
                    <span className="text-slate-500"> ({commercialEntitlement.reason})</span>
                  )}
                </li>
                {orgCommercialBrief.subscription?.cancelAtPeriodEnd && (
                  <li className="text-amber-800">Cancellation scheduled at period end.</li>
                )}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Capacity</p>
              <ul className="mt-2 space-y-1">
                <li>
                  Workspaces: {orgCommercialBrief._count.workspaces}
                </li>
                <li>
                  Seats: {seatsInUse} members + {pendingInviteCount} pending invites / cap {seatCap}
                  {seatsAtCap ? (
                    <span className="ml-1 text-amber-800">(at or over seat cap)</span>
                  ) : null}
                </li>
                <li>Active API keys: {apiKeyCount}</li>
                <li>
                  Monthly scan limit (plan): {orgCommercialBrief.subscription?.maxScansPerMonth ?? '—'}
                </li>
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Commercial snapshot unavailable (database error).</p>
        )}
        <div>
          <p className="text-sm font-medium text-slate-900">Recent product decision events</p>
          <p className="text-xs text-slate-500 mt-1">
            Logged to audit with actions {productDecisionActions.join(', ')}.
          </p>
          {recentProductEvents.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No product decision events recorded yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-slate-100 text-sm">
              {recentProductEvents.map((row) => (
                <li key={row.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span className="font-mono text-xs text-slate-800">{row.action}</span>
                  <time className="text-xs text-slate-500" dateTime={row.createdAt.toISOString()}>
                    {formatIsoDateTime(row.createdAt.toISOString())}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
          <p className="font-medium">Could not load full platform report</p>
          <p className="mt-1">{loadError}</p>
          <p className="mt-2 text-red-800">
            The UI stays usable; fix database connectivity or run{' '}
            <code className="rounded bg-red-100 px-1">npm run db:migrate</code> and{' '}
            <code className="rounded bg-red-100 px-1">npm run bootstrap</code>.
          </p>
        </div>
      )}

      {payload && (
        <>
          <section
            className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(19rem,1fr)]"
            aria-labelledby="overview-heading"
          >
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-50 shadow-sm">
              <div className="space-y-5 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                      Operator control plane
                    </p>
                    <h2 id="overview-heading" className="text-2xl font-semibold tracking-tight">
                      Current platform truth for {membership.organization.name}
                    </h2>
                    <p className="max-w-2xl text-sm text-slate-300">
                      This summary is derived from live dependency checks, queue pressure, and worker heartbeat evidence.
                      Acknowledgements may reduce noise, but they never change the underlying health model.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Checked</p>
                    <p className="mt-1 text-sm font-medium text-white">{formatIsoDateTime(payload.report.checkedAt)}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Route shell blocker: {platformTruth?.shellBlocker ?? 'not available'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryMetric
                    label="Readiness"
                    value={payload.report.bootstrap.readiness}
                    hint={payload.report.bootstrap.installed ? 'Bootstrap installed' : 'Installation incomplete'}
                  />
                  <SummaryMetric
                    label="Critical blockers"
                    value={String(criticalIssueCount)}
                    hint={criticalIssueCount === 0 ? 'No blocker-level diagnostics' : 'Immediate operator attention'}
                  />
                  <SummaryMetric
                    label="Unhealthy services"
                    value={String(unhealthyServiceCount)}
                    hint={unhealthyServiceCount === 0 ? 'All core services nominal' : 'Includes degraded and failed states'}
                  />
                  <SummaryMetric
                    label="Optional issues"
                    value={String(optionalIssueCount)}
                    hint={optionalIssueCount === 0 ? 'No optional gaps surfaced' : 'Core workflows may still continue'}
                  />
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                  <TruthCallout
                    title="Operator pressure"
                    value={
                      criticalIssueCount > 0
                        ? `${criticalIssueCount} blocker${criticalIssueCount === 1 ? '' : 's'}`
                        : recoverableIssueCount > 0
                          ? `${recoverableIssueCount} recoverable issue${recoverableIssueCount === 1 ? '' : 's'}`
                          : 'No active blockers'
                    }
                    detail={
                      criticalIssueCount > 0
                        ? 'Core flows may be impaired. Work top-down from blockers before polishing optional integrations.'
                        : 'The operator queue is focused on recoverable warnings and optional service gaps.'
                    }
                  />
                  <TruthCallout
                    title="User-facing risk"
                    value={payload.routePlatformTruth.userImpactSummary.length > 0 ? 'Degraded paths exist' : 'No active impact surfaced'}
                    detail={
                      payload.routePlatformTruth.userImpactSummary[0] ??
                      'No user-safe impact statements were generated from the latest report.'
                    }
                  />
                  <TruthCallout
                    title="Operator hints"
                    value={warningIssueCount > 0 ? `${warningIssueCount} warning${warningIssueCount === 1 ? '' : 's'}` : 'No active warnings'}
                    detail={
                      payload.routePlatformTruth.operatorRemediationHints[0] ??
                      'Route-level remediation hints are clear at the moment.'
                    }
                  />
                </div>
              </div>
            </div>

            <section className="card space-y-4" aria-labelledby="operator-focus-heading">
              <div>
                <h2 id="operator-focus-heading" className="text-lg font-semibold text-slate-900">
                  Focus next
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  A compact operator handoff from live data so the next action is explicit on desktop and mobile.
                </p>
              </div>
              <ul className="space-y-3 text-sm">
                <FocusRow
                  label="Fix first"
                  value={
                    criticalIssueCount > 0
                      ? `${criticalIssueCount} blocker${criticalIssueCount === 1 ? '' : 's'} still block readiness`
                      : 'No blocker-level issues are currently open'
                  }
                />
                <FocusRow
                  label="Repair path"
                  value={
                    payload.operatorFlagsStatus.requiresRepair
                      ? 'Legacy operator-flag fallback is active for this org'
                      : 'No org-scoped flag repair is currently required'
                  }
                />
                <FocusRow
                  label="Worker truth"
                  value={
                    payload.routePlatformTruth.flags.workerRunning
                      ? 'Workers are reporting live heartbeat data'
                      : 'Workers are not currently reporting healthy heartbeat data'
                  }
                />
                <FocusRow
                  label="Queue truth"
                  value={
                    payload.routePlatformTruth.flags.jobPipelinesHealthy
                      ? 'Job pipelines are processing or degraded-but-running'
                      : 'Job pipelines are not healthy enough to trust automation freshness'
                  }
                />
              </ul>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-medium text-slate-900">JSON and audit trail</p>
                <p className="mt-1">
                  The authenticated JSON API and organization-scoped audit feed below remain the canonical operator
                  evidence surfaces for repeat checks and release sign-off.
                </p>
              </div>
            </section>
          </section>

          <section className="card space-y-4" aria-labelledby="setup-heading">
            <h2 id="setup-heading" className="text-lg font-semibold text-slate-900">
              First-run &amp; setup checklist
            </h2>
            <p className="text-sm text-slate-600">
              Blocking steps must pass before the deployment is ready for normal operator use. Optional steps improve
              integrations but do not gate core scanning.
            </p>
            <ol className="mt-2 space-y-2">
              {payload.diagnostics.setupChecklist.map((step) => (
                <li
                  key={step.id}
                  className={`flex flex-wrap items-start gap-2 rounded-md border p-3 text-sm ${
                    step.done ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/40'
                  }`}
                >
                  <span className="font-mono text-xs text-slate-500 shrink-0" aria-hidden>
                    {step.done ? '✓' : '○'}
                  </span>
                  <div>
                    <p className="font-medium text-slate-900">{step.title}</p>
                    <p className="text-slate-600 mt-0.5">{step.detail}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {step.blocking ? 'Blocking' : 'Non-blocking'} ·{' '}
                      {step.fixInProduct ? 'Fix in product where applicable' : 'Fix in deployment / infrastructure'}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="card space-y-4" aria-labelledby="operator-actions-heading">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="operator-actions-heading" className="text-lg font-semibold text-slate-900">
                  Operator actions
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  In-product actions are constrained to organization-scoped truth. Deployment-managed configuration is
                  summarized here but never edited from this screen.
                </p>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                {canRunOperatorActions ? 'Manage enabled' : 'View-only mode'}
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {payload.operatorActions.map((a) => (
                <div key={a.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <p className="font-medium text-slate-900">{a.label}</p>
                  <p className="mt-1 text-slate-600">{a.description}</p>
                  <p className="mt-2 font-mono text-[11px] text-slate-500">
                    {a.method} {a.pathSuffix}
                  </p>
                </div>
              ))}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-medium text-slate-900">Operator flag state source</p>
                <p className="mt-1">
                  <span className="font-mono text-xs">{payload.operatorFlagsStatus.source}</span>
                  {payload.operatorFlagsStatus.requiresRepair
                    ? ' — legacy fallback is still active for this organization.'
                    : ' — organization-scoped state is in use, or no operator flags are present.'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-medium text-slate-900">Legacy retirement dependence</p>
                <p className="mt-1">
                  <span className="font-mono text-xs">{payload.legacyRetirement.currentOrganization.dependence}</span>
                  {payload.legacyRetirement.currentOrganization.requiresRepair
                    ? ' — this org still needs compatibility-fallback repair.'
                    : ' — this org is not currently depending on compatibility fallback.'}
                </p>
              </div>
            </div>
            {canRunOperatorActions ? (
              <OperatorControlPlaneClient
                organizationId={orgId}
                optionalIssueIds={optionalDiagnosticIds(payload)}
                initialSuppressedIds={
                  payload.operatorFlags.prefs.suppressedOptionalDiagnosticIds
                }
                fallbackModeActive={payload.operatorFlagsStatus.requiresRepair}
                initialRetirementReadiness={payload.legacyRetirement.operatorScope?.readiness ?? null}
              />
            ) : (
              <p className="text-sm text-slate-600" role="status">
                Your role can view diagnostics but cannot run in-product platform actions. Ask an organization owner or
                admin.
              </p>
            )}
          </section>

          <DiagnosticBucketsSection orgId={orgId} payload={payload} canAcknowledge={canRunOperatorActions} />

          <section className="card space-y-3" aria-labelledby="audit-heading">
            <h2 id="audit-heading" className="text-lg font-semibold text-slate-900">
              Recent platform actions (audit)
            </h2>
            <p className="text-sm text-slate-600">
              Organization-scoped audit entries for rechecks, acknowledgements, and operator preferences. No secrets are
              stored in metadata.
            </p>
            {payload.recentPlatformActions.length === 0 ? (
              <p className="text-sm text-slate-500">No platform actions recorded yet for this organization.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {payload.recentPlatformActions.map((row: (typeof payload.recentPlatformActions)[number]) => (
                  <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div>
                      <p className="font-mono text-xs text-slate-700">{row.action}</p>
                      <p className="mt-1 text-xs text-slate-500">Organization-scoped control-plane event</p>
                    </div>
                    <time className="text-right text-xs text-slate-500" dateTime={row.createdAt.toISOString()}>
                      {formatIsoDateTime(row.createdAt.toISOString())}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card space-y-4" aria-labelledby="readiness-heading">
            <h2 id="readiness-heading" className="text-lg font-semibold text-slate-900">
              Platform readiness
            </h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Installed</dt>
                <dd className="mt-1 text-slate-900">
                  {payload.report.bootstrap.installed ? 'Yes' : 'No — run migrations and bootstrap'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Readiness</dt>
                <dd className="mt-1">
                  <span className="badge bg-slate-100 text-slate-800">{payload.report.bootstrap.readiness}</span>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Environment validation</dt>
                <dd className="mt-1 text-slate-900">
                  {payload.envDiagnostics.valid ? (
                    'Valid'
                  ) : (
                    <span>
                      Invalid — see keys: {payload.envDiagnostics.invalidKeys.join(', ') || '(see server logs)'}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
            {payload.report.bootstrap.blockers.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-red-800">Blockers</h3>
                <ul className="mt-2 list-inside list-disc text-sm text-red-900">
                  {payload.report.bootstrap.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
            {payload.report.bootstrap.warnings.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-amber-800">Warnings</h3>
                <ul className="mt-2 list-inside list-disc text-sm text-amber-900">
                  {payload.report.bootstrap.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="card space-y-4" aria-labelledby="deps-heading">
            <h2 id="deps-heading" className="text-lg font-semibold text-slate-900">
              Dependencies
            </h2>
            <ul className="space-y-2 text-sm">
              <DependencyRow label="PostgreSQL" result={payload.report.dependencies.database} />
              <DependencyRow label="Redis" result={payload.report.dependencies.redis} />
              <DependencyRow label="Sessions" result={payload.report.dependencies.sessionStore} />
              <DependencyRow
                label="Outbound email (SMTP)"
                result={payload.report.dependencies.outboundEmail}
              />
            </ul>
          </section>

          <section className="card space-y-4" aria-labelledby="queues-heading">
            <h2 id="queues-heading" className="text-lg font-semibold text-slate-900">
              BullMQ queue depths
            </h2>
            <p className="text-sm text-slate-600">
              Live <span className="font-mono text-xs">waiting</span>,{" "}
              <span className="font-mono text-xs">active</span>, and{" "}
              <span className="font-mono text-xs">failed</span> counts from Redis (same source as job-pipelines health).
              When Redis is down, depths are unavailable—see Dependencies above.
            </p>
            {payload.report.jobQueueDepths ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Queue</th>
                      <th className="px-3 py-2 font-semibold">Waiting</th>
                      <th className="px-3 py-2 font-semibold">Active</th>
                      <th className="px-3 py-2 font-semibold">Failed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queueDepthRows(payload.report.jobQueueDepths.snapshot).map((row) => (
                      <tr key={row.name} className="border-b border-slate-100">
                        <td className="px-3 py-2 font-mono text-xs text-slate-800">{row.name}</td>
                        <td className="px-3 py-2 tabular-nums">{row.waiting}</td>
                        <td className="px-3 py-2 tabular-nums">{row.active}</td>
                        <td className="px-3 py-2 tabular-nums text-red-800">{row.failed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-3 py-2 text-xs text-slate-500">
                  Checked {formatIsoDateTime(payload.report.jobQueueDepths.checkedAt)} · Abuse-sensitive API rate limits
                  use Redis when healthy; otherwise the app falls back to per-process windows (
                  <Link href="/api/health?detailed=true" className="font-medium text-brand-700 hover:underline">
                    detailed health
                  </Link>
                  ).
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Queue depths not available (Redis unreachable, build-time snapshot, or probes skipped).
              </p>
            )}
          </section>


          <section aria-labelledby="services-heading">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <h2 id="services-heading" className="text-lg font-semibold text-slate-900">
                Core services
              </h2>
              <Link
                href={`/api/org/${orgId}/platform/health`}
                className="text-sm text-brand-600 hover:text-brand-700"
                prefetch={false}
              >
                JSON API (authenticated)
              </Link>
            </div>
            <div className="space-y-3" data-testid="core-services-list">
              {payload.report.services.map((svc) => {
                const diag = diagnosticForService(payload.diagnostics.issues, svc.id);
                return (
                <article
                  key={svc.id}
                  className="card border border-slate-200"
                  aria-labelledby={`svc-${svc.id}-title`}
                  data-service-id={svc.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 id={`svc-${svc.id}-title`} className="font-semibold text-slate-900">
                        {svc.name}
                      </h3>
                      <p className="text-sm text-slate-600 mt-1">{svc.purpose}</p>
                      <p className="text-xs text-slate-500 mt-2">
                        Scope: {svc.scope} · {svc.criticality === 'critical' ? 'Critical' : 'Optional'}
                      </p>
                    </div>
                    <span
                      className={`badge shrink-0 ${healthStateStyles[svc.healthState] ?? 'bg-slate-100 text-slate-800'}`}
                    >
                      {svc.healthState}
                    </span>
                  </div>
                  {diag && (
                    <div
                      className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm space-y-2"
                      data-testid={`service-diagnostic-${svc.id}`}
                    >
                      <p className="font-medium text-slate-900">Operator diagnostic</p>
                      <dl className="grid gap-1 text-xs sm:grid-cols-2 text-slate-700">
                        <div>
                          <dt className="text-slate-500">Severity</dt>
                          <dd className="font-mono">{diag.severity}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Blocks readiness</dt>
                          <dd>{diag.blocksReadiness ? 'Yes' : 'No'}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">End-user impact</dt>
                          <dd>{diag.appUsable ? 'App may still be usable' : 'App likely unusable for core flows'}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Fix location</dt>
                          <dd>
                            {diag.fixInProduct ? 'In-product / org settings' : 'Deployment or infrastructure'}
                            {diag.requiresDeployOrInfra ? ' (env change required)' : ''}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Recheck safe</dt>
                          <dd>{diag.retrySafe ? 'Yes' : 'No — may need infra change first'}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Who acts</dt>
                          <dd className="font-mono text-[11px]">{diag.whoShouldAct}</dd>
                        </div>
                      </dl>
                      <p className="text-slate-800">
                        <span className="font-medium">Summary: </span>
                        {diag.summary}
                      </p>
                      <p className="text-slate-700">
                        <span className="font-medium">Impact: </span>
                        {diag.impactUser}
                      </p>
                      <p className="text-slate-700">
                        <span className="font-medium">Operator: </span>
                        {diag.impactOperator}
                      </p>
                      <p className="text-slate-800">
                        <span className="font-medium">Next step: </span>
                        {diag.recommendedNextStep}
                      </p>
                      {diag.evidence.length > 0 && (
                        <details>
                          <summary className="cursor-pointer text-xs font-medium text-slate-600">Evidence</summary>
                          <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
                            {diag.evidence.map((ev) => (
                              <li key={ev}>{ev}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                      {canRunOperatorActions && (
                        <IssueAcknowledgeButton organizationId={orgId} issue={diag} />
                      )}
                    </div>
                  )}
                  <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-slate-500">Enabled</dt>
                      <dd className="text-slate-900">{svc.enabled ? 'Yes' : 'No'}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Config</dt>
                      <dd className="text-slate-900">{svc.configState}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-slate-500">Last check</dt>
                      <dd className="text-slate-900">{svc.lastCheckAt ?? '—'}</dd>
                    </div>
                    {svc.lastActivityAt && (
                      <div className="sm:col-span-2">
                        <dt className="text-slate-500">Last activity</dt>
                        <dd className="text-slate-900">{svc.lastActivityAt}</dd>
                      </div>
                    )}
                  </dl>
                  {svc.configIssues.length > 0 && (
                    <ul className="mt-3 list-inside list-disc text-sm text-orange-900">
                      {svc.configIssues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  )}
                  {svc.failureReason && (
                    <p className="mt-3 text-sm text-red-800">
                      <span className="font-medium">Failure: </span>
                      {svc.failureReason}
                    </p>
                  )}
                  <p className="mt-3 text-sm text-slate-700">
                    <span className="font-medium text-slate-900">Next step: </span>
                    {svc.nextStep}
                  </p>
                  {Object.keys(svc.configSummary).length > 0 && (
                    <details className="mt-3 text-xs text-slate-600">
                      <summary className="cursor-pointer font-medium text-slate-700">Non-sensitive config summary</summary>
                      <pre className="mt-2 overflow-x-auto rounded bg-slate-50 p-2 text-slate-800">
                        {JSON.stringify(svc.configSummary, null, 2)}
                      </pre>
                    </details>
                  )}
                </article>
              );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function optionalDiagnosticIds(payload: NonNullable<Awaited<ReturnType<typeof getPlatformHealthPayload>>>) {
  const optionalSvcIds = new Set(
    payload.report.services.filter((s) => s.criticality === 'optional').map((s) => s.id)
  );
  return payload.diagnostics.issues
    .filter((i) => i.target.kind === 'service' && optionalSvcIds.has(i.target.id))
    .map((i) => i.id);
}

function diagnosticForService(issues: PlatformDiagnosticIssue[], serviceId: string) {
  return issues.find((i) => i.target.kind === 'service' && i.target.id === serviceId) ?? null;
}

function DiagnosticBucketsSection({
  orgId,
  payload,
  canAcknowledge,
}: {
  orgId: string;
  payload: NonNullable<Awaited<ReturnType<typeof getPlatformHealthPayload>>>;
  canAcknowledge: boolean;
}) {
  const s = payload.diagnostics.summary;
  return (
    <section className="card space-y-4" aria-labelledby="diagnostics-heading">
      <h2 id="diagnostics-heading" className="text-lg font-semibold text-slate-900">
        Control plane summary
      </h2>
      <p className="text-sm text-slate-600">
        Derived from the same live report as core services. Acknowledgements and optional suppressions only change how
        issues are highlighted — not underlying connectivity.
      </p>
      <BucketList
        title="Critical blockers"
        issues={s.criticalBlockers}
        orgId={orgId}
        tone="red"
        canAcknowledge={canAcknowledge}
      />
      <BucketList
        title="Recoverable / high severity"
        issues={s.recoverableIssues}
        orgId={orgId}
        tone="amber"
        canAcknowledge={canAcknowledge}
      />
      <BucketList title="Warnings" issues={s.warnings} orgId={orgId} tone="amber" canAcknowledge={canAcknowledge} />
      <BucketList
        title="Optional services affected"
        issues={s.optionalUnavailable}
        orgId={orgId}
        tone="slate"
        canAcknowledge={canAcknowledge}
      />
      {s.acknowledgedIssues.length > 0 && (
        <BucketList
          title="Acknowledged (informational)"
          issues={s.acknowledgedIssues}
          orgId={orgId}
          tone="slate"
          canAcknowledge={canAcknowledge}
        />
      )}
    </section>
  );
}

function BucketList({
  title,
  issues,
  orgId,
  tone,
  canAcknowledge,
}: {
  title: string;
  issues: PlatformDiagnosticIssue[];
  orgId: string;
  tone: 'red' | 'amber' | 'slate';
  canAcknowledge: boolean;
}) {
  const border =
    tone === 'red' ? 'border-red-200' : tone === 'amber' ? 'border-amber-200' : 'border-slate-200';
  if (issues.length === 0) {
    return (
      <div className={`rounded-lg border ${border} p-3`}>
        <h3 className="text-sm font-medium text-slate-800">{title}</h3>
        <p className="text-sm text-slate-500 mt-1">None</p>
      </div>
    );
  }
  return (
    <div className={`rounded-lg border ${border} p-3 space-y-2`}>
      <h3 className="text-sm font-medium text-slate-900">{title}</h3>
      <ul className="space-y-3">
        {issues.map((issue) => (
          <li key={issue.id} className="text-sm text-slate-700 border-t border-slate-100 pt-2 first:border-0 first:pt-0">
            <p className="font-medium text-slate-900">{issue.summary}</p>
            <p className="text-xs text-slate-500 mt-1 font-mono">{issue.id}</p>
            <p className="mt-1">{issue.recommendedNextStep}</p>
            {canAcknowledge && <IssueAcknowledgeButton organizationId={orgId} issue={issue} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DependencyRow({
  label,
  result,
}: {
  label: string;
  result: { ok: boolean; message?: string; checkedAt: string };
}) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-2 last:border-0">
      <span className="font-medium text-slate-800">{label}</span>
      <span className={result.ok ? 'text-emerald-700' : 'text-red-700'}>
        {result.ok ? 'OK' : result.message ?? 'Failed'}
      </span>
    </li>
  );
}

function SummaryMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-300">{hint}</p>
    </div>
  );
}

function TruthCallout({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{title}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-300">{detail}</p>
    </div>
  );
}

function FocusRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-800">{value}</p>
    </li>
  );
}

function formatIsoDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function queueDepthRows(snapshot: JobQueueDepthSnapshot) {
  return [
    { name: 'crawl', ...snapshot.crawl },
    { name: 'scan', ...snapshot.scan },
    { name: 'cluster', ...snapshot.cluster },
    { name: 'remediation', ...snapshot.remediation },
    { name: 'public-scan', ...snapshot.publicScan },
    { name: 'visual-review', ...snapshot.visualReview },
  ];
}
