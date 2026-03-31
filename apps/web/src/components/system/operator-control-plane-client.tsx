'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition, type ReactNode } from 'react';
import type { PlatformDiagnosticIssue } from '@aros/core-services';
import { ArosMeshVisualization } from './aros-mesh-visualization';

interface Props {
  organizationId: string;
  optionalIssueIds: string[];
  initialSuppressedIds: string[];
  fallbackModeActive: boolean;
  initialRetirementReadiness: {
    status: 'fallback_detected' | 'no_fallback_observed' | 'unknown';
    inspectedOrganizationCount: number;
    fallbackOrganizationCount: number;
    reason: string;
  } | null;
}

export function OperatorControlPlaneClient({
  organizationId,
  optionalIssueIds,
  initialSuppressedIds,
  fallbackModeActive,
  initialRetirementReadiness,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<
    'recheck' | 'backfill' | 'retirement' | 'suppressions' | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [suppressed, setSuppressed] = useState<Set<string>>(() => new Set(initialSuppressedIds));
  const [retirementReadiness, setRetirementReadiness] = useState(initialRetirementReadiness);

  const base = `/api/org/${organizationId}/platform`;

  const beginAction = useCallback((action: NonNullable<typeof activeAction>) => {
    setActiveAction(action);
    setActionError(null);
    setActionMessage(null);
  }, []);

  const runRecheck = useCallback(() => {
    beginAction('recheck');
    startTransition(async () => {
      try {
        const res = await fetch(`${base}/recheck`, { method: 'POST' });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.success) {
          setActionError(body?.error?.message ?? `Recheck failed (${res.status})`);
          return;
        }
        setActionMessage(`Recheck completed at ${body.data?.checkedAt ?? 'now'}.`);
        router.refresh();
      } catch {
        setActionError('Network error during recheck.');
      } finally {
        setActiveAction(null);
      }
    });
  }, [base, beginAction, router]);

  const runLegacyBackfill = useCallback(() => {
    beginAction('backfill');
    startTransition(async () => {
      try {
        const res = await fetch(`${base}/repair-legacy-flags`, { method: 'POST' });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.success) {
          setActionError(body?.error?.message ?? `Repair failed (${res.status})`);
          return;
        }
        const status = body?.data?.result?.status;
        if (status === 'migrated') {
          setActionMessage('Legacy fallback data was backfilled to this organization.');
        } else if (status === 'skipped_scoped_present') {
          setActionMessage('No repair needed. Organization-scoped operator state already exists.');
        } else {
          setActionMessage('No legacy fallback data was available to backfill.');
        }
        router.refresh();
      } catch {
        setActionError('Network error during legacy backfill.');
      } finally {
        setActiveAction(null);
      }
    });
  }, [base, beginAction, router]);

  const saveSuppressions = useCallback(() => {
    beginAction('suppressions');
    startTransition(async () => {
      try {
        const res = await fetch(`${base}/operator-preferences`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ suppressedOptionalDiagnosticIds: [...suppressed] }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.success) {
          setActionError(body?.error?.message ?? `Save failed (${res.status})`);
          return;
        }
        setActionMessage('Optional diagnostic banner preferences updated.');
        router.refresh();
      } catch {
        setActionError('Network error saving preferences.');
      } finally {
        setActiveAction(null);
      }
    });
  }, [base, beginAction, router, suppressed]);

  const evaluateRetirementReadiness = useCallback(() => {
    beginAction('retirement');
    startTransition(async () => {
      try {
        const res = await fetch(`${base}/legacy-retirement`, { method: 'POST' });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.success) {
          setActionError(body?.error?.message ?? `Retirement evaluation failed (${res.status})`);
          return;
        }
        const readiness = body?.data?.evaluation?.readiness;
        if (readiness) {
          setRetirementReadiness(readiness);
        }
        setActionMessage('Legacy retirement readiness evaluated. Prune remains evidence-gated and blocked by default.');
        router.refresh();
      } catch {
        setActionError('Network error evaluating legacy retirement readiness.');
      } finally {
        setActiveAction(null);
      }
    });
  }, [base, beginAction, router]);

  const toggleSuppressed = (id: string, checked: boolean) => {
    setSuppressed((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        aria-live="polite"
        {...(pending ? { 'aria-busy': 'true' } : { 'aria-busy': 'false' })}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">Live operator actions</p>
            <p className="max-w-2xl text-sm text-slate-600">
              These controls run against live platform state. They never mark services healthy optimistically and they
              do not hide required infrastructure work.
            </p>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
            {pending ? 'Action in progress' : 'Idle'}
          </div>
        </div>

        {actionError ? (
          <div
            className="mt-4 rounded-lg border px-3 py-2 text-sm border-red-200 bg-red-50 text-red-900"
            role="alert"
          >
            {actionError}
          </div>
        ) : actionMessage ? (
          <div
            className="mt-4 rounded-lg border px-3 py-2 text-sm border-emerald-200 bg-emerald-50 text-emerald-900"
            role="status"
          >
            {actionMessage}
          </div>
        ) : null}

        <div className="mt-6">
          <ArosMeshVisualization />
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          <ActionPanel
            title="Recheck readiness"
            eyebrow="Runtime truth"
            description="Runs synchronous server-side checks and refreshes this report with current dependency, queue, and worker evidence."
            badge={pending && activeAction === 'recheck' ? 'Running now' : 'Safe to rerun'}
            onClick={runRecheck}
            disabled={pending}
            buttonLabel={pending && activeAction === 'recheck' ? 'Running checks…' : 'Run live recheck'}
            buttonTestId="platform-recheck-button"
          />

          <ActionPanel
            title="Retirement evidence"
            eyebrow="Legacy cleanup"
            description="Re-evaluates whether any organizations you can manage still depend on compatibility fallback keys."
            badge={retirementReadiness?.status ?? 'unknown'}
            onClick={evaluateRetirementReadiness}
            disabled={pending}
            buttonLabel={
              pending && activeAction === 'retirement'
                ? 'Evaluating…'
                : 'Evaluate retirement readiness'
            }
          >
            <dl className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
              <div className="rounded-md bg-slate-50 px-3 py-2">
                <dt className="text-slate-500">Inspectable orgs</dt>
                <dd className="mt-1 font-mono text-sm text-slate-900">
                  {retirementReadiness?.inspectedOrganizationCount ?? 0}
                </dd>
              </div>
              <div className="rounded-md bg-slate-50 px-3 py-2">
                <dt className="text-slate-500">Fallback orgs</dt>
                <dd className="mt-1 font-mono text-sm text-slate-900">
                  {retirementReadiness?.fallbackOrganizationCount ?? 0}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-slate-600">
              {retirementReadiness?.reason ?? 'Run evaluation to refresh retirement evidence.'}
            </p>
          </ActionPanel>

          <ActionPanel
            title="Compatibility fallback"
            eyebrow="Organization-scoped truth"
            description={
              fallbackModeActive
                ? 'This org is still reading legacy deployment-wide operator flags. Backfill copies them into org-scoped state without pretending the fallback is retired.'
                : 'This org is not currently using the legacy shared-state operator flag fallback.'
            }
            badge={fallbackModeActive ? 'Repair recommended' : 'Scoped state only'}
            onClick={runLegacyBackfill}
            disabled={pending || !fallbackModeActive}
            buttonLabel={
              pending && activeAction === 'backfill'
                ? 'Backfilling…'
                : fallbackModeActive
                  ? 'Backfill legacy operator flags'
                  : 'No backfill needed'
            }
            tone={fallbackModeActive ? 'amber' : 'emerald'}
          >
            <p className={`text-xs ${fallbackModeActive ? 'text-amber-800' : 'text-emerald-800'}`}>
              {fallbackModeActive
                ? 'Run this once to eliminate silent shared-state reads for this organization.'
                : 'No compatibility repair action is currently required for this organization.'}
            </p>
          </ActionPanel>

          {optionalIssueIds.length > 0 && (
            <ActionPanel
              title="Optional banner suppression"
              eyebrow="Operator preference"
              description="Hides selected optional-service diagnostics from summary banners for this organization only. It never disables the integrations themselves."
              badge={`${suppressed.size}/${optionalIssueIds.length} hidden`}
              onClick={saveSuppressions}
              disabled={pending}
              buttonLabel={
                pending && activeAction === 'suppressions'
                  ? 'Saving…'
                  : 'Save suppression preferences'
              }
            >
              <fieldset>
                <legend className="sr-only">Optional service banner suppression</legend>
                <ul className="space-y-2">
                  {optionalIssueIds.map((id) => (
                    <li key={id} className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm">
                      <label htmlFor={`suppress-${id}`} className="flex items-start gap-3">
                        <input
                          id={`suppress-${id}`}
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
                          checked={suppressed.has(id)}
                          onChange={(e) => toggleSuppressed(id, e.target.checked)}
                          aria-describedby={`suppress-${id}-hint`}
                        />
                        <span className="space-y-1">
                          <span className="font-mono text-xs text-slate-700">{id}</span>
                          <span id={`suppress-${id}-hint`} className="block text-xs text-slate-500">
                            Hide this optional diagnostic from banner summaries for this organization.
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            </ActionPanel>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionPanel({
  title,
  eyebrow,
  description,
  badge,
  tone = 'slate',
  buttonLabel,
  onClick,
  disabled,
  children,
  buttonTestId,
}: {
  title: string;
  eyebrow: string;
  description: string;
  badge: string;
  tone?: 'slate' | 'amber' | 'emerald';
  buttonLabel: string;
  onClick: () => void;
  disabled: boolean;
  children?: ReactNode;
  buttonTestId?: string;
}) {
  const toneClasses =
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50/70'
      : tone === 'emerald'
        ? 'border-emerald-200 bg-emerald-50/70'
        : 'border-slate-200 bg-slate-50/70';

  return (
    <section className={`rounded-xl border p-4 ${toneClasses}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{eyebrow}</p>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        </div>
        <span className="rounded-full border border-white/80 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-700">
          {badge}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      {children && <div className="mt-4 space-y-3">{children}</div>}
      <button
        type="button"
        data-testid={buttonTestId}
        onClick={onClick}
        disabled={disabled}
        className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {buttonLabel}
      </button>
    </section>
  );
}

export function IssueAcknowledgeButton({
  organizationId,
  issue,
}: {
  organizationId: string;
  issue: PlatformDiagnosticIssue;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const canAck =
    !issue.acknowledged &&
    (!issue.blocksReadiness || ['medium', 'low', 'info'].includes(issue.severity));

  if (issue.acknowledged) {
    return (
      <p className="text-xs text-slate-500" role="status">
        Acknowledged (informational only).
      </p>
    );
  }

  if (!canAck) {
    return null;
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setErr(null);
          startTransition(async () => {
            try {
              const res = await fetch(`/api/org/${organizationId}/platform/acknowledge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ issueId: issue.id }),
              });
              const body = await res.json().catch(() => null);
              if (!res.ok || !body?.success) {
                setErr(body?.error?.message ?? 'Acknowledge failed');
                return;
              }
              router.refresh();
            } catch {
              setErr('Network error');
            }
          });
        }}
        className="text-sm text-brand-700 underline-offset-2 hover:underline disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Acknowledge (does not repair)'}
      </button>
      {err && (
        <p className="mt-1 text-xs text-red-700" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}
