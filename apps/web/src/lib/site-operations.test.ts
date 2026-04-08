import { describe, expect, it } from 'vitest';
import { rollupSiteOperations, summarizeSiteOperations } from './site-operations';

const entitled = { hasPaidAccess: true, reason: 'active_paid' } as const;
const free = { hasPaidAccess: false, reason: 'free_plan' } as const;

describe('summarizeSiteOperations', () => {
  it('returns activation_required when pages/crawls do not exist', () => {
    const result = summarizeSiteOperations({
      pagesCount: 0,
      openFindings: 0,
      latestCrawlStatus: null,
      latestScanStatus: null,
      latestScanCompletedAt: null,
      scheduleCron: null,
      entitlement: entitled,
      workerRunning: true,
      jobPipelinesHealthy: true,
    });

    expect(result.status).toBe('activation_required');
    expect(result.nextAction.href).toBe('/sites');
  });

  it('returns scan_attention_required when latest scan failed', () => {
    const result = summarizeSiteOperations({
      pagesCount: 80,
      openFindings: 10,
      latestCrawlStatus: 'COMPLETED',
      latestScanStatus: 'FAILED',
      latestScanCompletedAt: null,
      scheduleCron: '@daily',
      entitlement: entitled,
      workerRunning: true,
      jobPipelinesHealthy: true,
    });

    expect(result.status).toBe('scan_attention_required');
    expect(result.nextAction.href).toBe('/system');
  });

  it('returns automation_degraded for free plan orgs', () => {
    const result = summarizeSiteOperations({
      pagesCount: 80,
      openFindings: 10,
      latestCrawlStatus: 'COMPLETED',
      latestScanStatus: 'COMPLETED',
      latestScanCompletedAt: new Date(),
      scheduleCron: '@daily',
      entitlement: free,
      workerRunning: true,
      jobPipelinesHealthy: true,
    });

    expect(result.status).toBe('automation_degraded');
    expect(result.nextAction.href).toBe('/settings/billing');
  });

  it('returns evidence_stale when latest verification is older than 72h', () => {
    const stale = new Date(Date.now() - 1000 * 60 * 60 * 90);
    const result = summarizeSiteOperations({
      pagesCount: 80,
      openFindings: 3,
      latestCrawlStatus: 'COMPLETED',
      latestScanStatus: 'COMPLETED',
      latestScanCompletedAt: stale,
      scheduleCron: '@weekly',
      entitlement: entitled,
      workerRunning: true,
      jobPipelinesHealthy: true,
    });

    expect(result.status).toBe('evidence_stale');
  });

  it('returns healthy when queues are healthy and scan evidence is fresh', () => {
    const recent = new Date(Date.now() - 1000 * 60 * 60 * 10);
    const result = summarizeSiteOperations({
      pagesCount: 80,
      openFindings: 0,
      latestCrawlStatus: 'COMPLETED',
      latestScanStatus: 'COMPLETED',
      latestScanCompletedAt: recent,
      scheduleCron: '@weekly',
      entitlement: entitled,
      workerRunning: true,
      jobPipelinesHealthy: true,
    });

    expect(result.status).toBe('healthy');
  });
});

describe('rollupSiteOperations', () => {
  it('aggregates site status counts', () => {
    const summary = rollupSiteOperations([
      'activation_required',
      'activation_required',
      'scan_attention_required',
      'automation_degraded',
      'evidence_stale',
      'healthy',
    ]);

    expect(summary).toEqual({
      activationRequired: 2,
      scanAttentionRequired: 1,
      automationDegraded: 1,
      evidenceStale: 1,
      healthy: 1,
    });
  });
});
