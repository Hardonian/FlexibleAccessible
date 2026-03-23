'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState, useTransition } from 'react';
import type { PlatformDiagnosticIssue } from '@aros/core-services';

interface Props {
  organizationId: string;
  optionalIssueIds: string[];
  initialSuppressedIds: string[];
}

export function OperatorControlPlaneClient({
  organizationId,
  optionalIssueIds,
  initialSuppressedIds,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [suppressed, setSuppressed] = useState<Set<string>>(() => new Set(initialSuppressedIds));

  const base = `/api/org/${organizationId}/platform`;

  const runRecheck = useCallback(() => {
    setActionError(null);
    setActionMessage(null);
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
      }
    });
  }, [base, router]);

  const saveSuppressions = useCallback(() => {
    setActionError(null);
    setActionMessage(null);
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
      }
    });
  }, [base, router, suppressed]);

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
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          data-testid="platform-recheck-button"
          onClick={runRecheck}
          disabled={pending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? 'Running checks…' : 'Recheck readiness'}
        </button>
        <p className="text-sm text-slate-600 max-w-xl">
          Runs live checks synchronously on the server. Results replace the data below after refresh — there is no hidden
          optimistic green state.
        </p>
      </div>

      {actionError && (
        <p className="text-sm text-red-800" role="alert">
          {actionError}
        </p>
      )}
      {actionMessage && (
        <p className="text-sm text-slate-700" role="status">
          {actionMessage}
        </p>
      )}

      {optionalIssueIds.length > 0 && (
        <fieldset className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
          <legend className="px-1 text-sm font-medium text-slate-900">Optional service banner suppression</legend>
          <p className="mt-2 text-xs text-slate-600">
            Deployment-wide preference only. It hides specific optional-service diagnostics from summary banners; it does
            not disable integrations or change environment variables.
          </p>
          <ul className="mt-3 space-y-2">
            {optionalIssueIds.map((id) => (
              <li key={id} className="flex items-start gap-2 text-sm">
                <input
                  id={`suppress-${id}`}
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                  checked={suppressed.has(id)}
                  onChange={(e) => toggleSuppressed(id, e.target.checked)}
                  aria-describedby={`suppress-${id}-hint`}
                />
                <label htmlFor={`suppress-${id}`} className="text-slate-800">
                  <span className="font-mono text-xs text-slate-600">{id}</span>
                  <span id={`suppress-${id}-hint`} className="sr-only">
                    When checked, this optional diagnostic is suppressed from operator summary banners.
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={saveSuppressions}
            disabled={pending}
            className="mt-3 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60"
          >
            Save suppression preferences
          </button>
        </fieldset>
      )}
    </div>
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
