'use client';

import { updateFindingStatusAction } from './actions';

export function FindingStatusForm({
  findingId,
  defaultValue,
}: {
  findingId: string;
  defaultValue: string;
}) {
  return (
    <form action={updateFindingStatusAction} className="mt-1">
      <input type="hidden" name="findingId" value={findingId} />
      <label htmlFor="status-select" className="sr-only">
        Finding status
      </label>
      <select
        id="status-select"
        name="status"
        defaultValue={defaultValue}
        className="input text-sm"
        onChange={(e) => {
          e.currentTarget.form?.requestSubmit();
        }}
      >
        <option value="OPEN">Open</option>
        <option value="IN_PROGRESS">In Progress</option>
        <option value="FIXED">Fixed</option>
        <option value="WONT_FIX">Won&apos;t Fix</option>
        <option value="FALSE_POSITIVE">False Positive</option>
      </select>
    </form>
  );
}
