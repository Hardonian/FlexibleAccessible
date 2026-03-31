'use client';

import { updateFindingStatusAction } from './actions';

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'MITIGATED', label: 'Mitigated' },
  { value: 'FALSE_POSITIVE', label: 'False positive' },
  { value: 'WONT_FIX', label: "Won't fix / accepted risk" },
] as const;

export function FindingStatusForm({
  findingId,
  defaultValue,
  canManage,
  defaultNote,
}: {
  findingId: string;
  defaultValue: string;
  canManage: boolean;
  defaultNote: string | null;
}) {
  if (!canManage) {
    return (
      <div className="mt-1 space-y-1">
        <p className="text-sm font-medium text-slate-800">{humanStatus(defaultValue)}</p>
        {defaultNote && <p className="text-xs text-slate-600">Note: {defaultNote}</p>}
        <p className="text-xs text-slate-500">Your role cannot change remediation status.</p>
      </div>
    );
  }

  return (
    <form action={updateFindingStatusAction} className="mt-1 space-y-3">
      <input type="hidden" name="findingId" value={findingId} />
      <div>
        <label htmlFor="status-select" className="block text-xs text-slate-500 mb-1">
          Remediation status
        </label>
        <select
          id="status-select"
          name="status"
          defaultValue={defaultValue}
          className="input text-sm max-w-md"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Choose the new status, add an optional note, then apply once so both values persist together.
        </p>
      </div>
      <div>
        <label htmlFor="status-note" className="block text-xs text-slate-500 mb-1">
          Note (optional, stored when you apply)
        </label>
        <textarea
          id="status-note"
          name="note"
          rows={2}
          className="input text-sm w-full max-w-xl"
          placeholder="Reason for transition, owner, or acceptance reference"
          defaultValue={defaultNote ?? ''}
        />
      </div>
      <button type="submit" className="btn-secondary text-sm">
        Apply status & note
      </button>
    </form>
  );
}

function humanStatus(s: string) {
  return STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s.replace(/_/g, ' ').toLowerCase();
}
