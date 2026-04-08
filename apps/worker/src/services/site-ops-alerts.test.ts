import { describe, expect, it, vi } from 'vitest';
import { deriveSiteOpsAlertState, siteOpsAlertConstants } from './site-ops-alerts';

describe('deriveSiteOpsAlertState', () => {
  it('returns scan_attention_required when latest scan failed', () => {
    const result = deriveSiteOpsAlertState({
      latestScanStatus: 'FAILED',
      latestCompletedScanAt: null,
      hasAnyCompletedScan: false,
    });
    expect(result.state).toBe('scan_attention_required');
  });

  it('returns evidence_stale when no completed scan exists', () => {
    const result = deriveSiteOpsAlertState({
      latestScanStatus: 'PENDING',
      latestCompletedScanAt: null,
      hasAnyCompletedScan: false,
    });
    expect(result.state).toBe('evidence_stale');
  });

  it('returns evidence_stale when completed scan is older than threshold', () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-08T00:00:00.000Z');
    vi.setSystemTime(now);
    const result = deriveSiteOpsAlertState({
      latestScanStatus: 'COMPLETED',
      latestCompletedScanAt: new Date(now.getTime() - (siteOpsAlertConstants.STALE_HOURS + 1) * 60 * 60 * 1000),
      hasAnyCompletedScan: true,
    });
    expect(result.state).toBe('evidence_stale');
    vi.useRealTimers();
  });

  it('returns healthy when scan freshness is within threshold', () => {
    vi.useFakeTimers();
    const now = new Date('2026-04-08T00:00:00.000Z');
    vi.setSystemTime(now);
    const result = deriveSiteOpsAlertState({
      latestScanStatus: 'COMPLETED',
      latestCompletedScanAt: new Date(now.getTime() - 12 * 60 * 60 * 1000),
      hasAnyCompletedScan: true,
    });
    expect(result.state).toBe('healthy');
    vi.useRealTimers();
  });
});
