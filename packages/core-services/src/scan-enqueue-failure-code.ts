import type { ScanEnqueueFailureCode } from '@aros/db';

/**
 * Maps enqueue-time errors to a persisted, operator-facing code (not UI string matching).
 */
export function classifyScanEnqueueFailure(message: string): ScanEnqueueFailureCode {
  const m = message.toLowerCase();

  if (m.includes('oom') || m.includes('maxmemory') || m.includes('command rejected')) {
    return 'QUEUE_REJECTED';
  }

  if (
    m.includes('econnrefused') ||
    m.includes('enotfound') ||
    m.includes('etimedout') ||
    m.includes('redis')
  ) {
    return 'QUEUE_UNAVAILABLE';
  }

  return 'KICKOFF_FAILED_UNKNOWN';
}
