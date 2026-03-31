import { describe, expect, it } from 'vitest';
import { getAutomationEvidenceFreshnessDescriptor } from './evidence-freshness';

describe('getAutomationEvidenceFreshnessDescriptor', () => {
  it('returns null for non-automated findings', () => {
    expect(
      getAutomationEvidenceFreshnessDescriptor({
        evidenceSource: 'MANUAL_REVIEW',
        lastVerifiedAt: null,
        latestCompletedScanCompletedAt: null,
        jobPipelinesHealthy: true,
      })
    ).toBeNull();
  });

  it('returns stale when a newer scan exists', () => {
    const descriptor = getAutomationEvidenceFreshnessDescriptor({
      evidenceSource: 'AUTOMATED_AXE',
      lastVerifiedAt: new Date('2025-01-01T00:00:00.000Z'),
      latestCompletedScanCompletedAt: new Date('2025-01-02T00:00:00.000Z'),
      jobPipelinesHealthy: true,
    });

    expect(descriptor?.freshness).toBe('stale_newer_scan_exists');
    expect(descriptor?.badgeLabel).toBe('stale');
  });

  it('returns degraded when pipelines are unhealthy', () => {
    const descriptor = getAutomationEvidenceFreshnessDescriptor({
      evidenceSource: 'AUTOMATED_AXE',
      lastVerifiedAt: new Date('2025-01-02T00:00:00.000Z'),
      latestCompletedScanCompletedAt: new Date('2025-01-02T00:00:00.000Z'),
      jobPipelinesHealthy: false,
    });

    expect(descriptor?.freshness).toBe('pipeline_degraded');
    expect(descriptor?.tone).toBe('warning');
  });
});
