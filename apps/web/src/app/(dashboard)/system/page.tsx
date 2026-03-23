import Link from 'next/link';
import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { hasPermission } from '@aros/config';
import type { MemberRole } from '@aros/db';
import { redirect } from 'next/navigation';
import { getPlatformHealthPayload } from '@/lib/platform-health';
import { getRoutePlatformTruth } from '@/lib/platform-truth-cache';
import { RouteReliabilityNotice } from '@/components/reliability/route-reliability-notice';

export const metadata = { title: 'System & services - AROS' };

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

  const platformTruth = await getRoutePlatformTruth().catch(() => null);

  let payload: Awaited<ReturnType<typeof getPlatformHealthPayload>> | null = null;
  let loadError: string | null = null;
  try {
    payload = await getPlatformHealthPayload();
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Failed to load platform health';
    console.error('[system] platform health failed', e);
  }

  const orgId = membership.organizationId;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">System & core services</h1>
        <p className="text-slate-500 mt-1">
          Live deployment status for {membership.organization.name}. Values are derived from connectivity checks, queue
          metrics, and worker heartbeats — not static placeholders.
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
            </ul>
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
              {payload.report.services.map((svc) => (
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
              ))}
            </div>
          </section>
        </>
      )}
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
