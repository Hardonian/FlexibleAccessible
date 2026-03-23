export type ScanSiteActionState = {
  status:
    | 'idle'
    | 'queued'
    | 'already_pending'
    | 'already_running'
    | 'deduped'
    | 'no_pages'
    | 'queue_unavailable'
    | 'permission_denied'
    | 'error';
  message: string | null;
  variant: 'neutral' | 'error';
};

export const scanSiteInitialState: ScanSiteActionState = {
  status: 'idle',
  message: null,
  variant: 'neutral',
};
