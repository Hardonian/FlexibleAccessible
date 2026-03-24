'use client';

import { useActionState } from 'react';
import { updateAutoScanAfterCrawlAction } from './actions';

export function AutoScanAfterCrawlForm({
  siteId,
  initialEnabled,
}: {
  siteId: string;
  initialEnabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateAutoScanAfterCrawlAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="siteId" value={siteId} />
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          name="autoScanAfterCrawl"
          defaultChecked={initialEnabled}
          className="mt-1 h-4 w-4 rounded border-slate-300"
        />
        <span className="text-sm text-slate-700">
          <span className="font-medium text-slate-900">Queue verification after crawl</span>
          <span className="block text-slate-500 mt-1">
            When enabled, a successful crawl that discovers pages attempts to enqueue a verification scan automatically.
            The crawl can still finish even if the scan cannot be queued. Redis, workers, and queue health affect whether
            the follow-on scan actually starts.
          </span>
        </span>
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
        {state?.ok === true ? <span className="text-sm text-green-700">Saved.</span> : null}
        {state?.ok === false ? (
          <span className="text-sm text-red-700" role="alert">
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
