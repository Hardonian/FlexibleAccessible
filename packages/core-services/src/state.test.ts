import { describe, expect, it } from 'vitest';
import {
  deriveReadinessFromServices,
  isWorkerHeartbeatStale,
  queueFailurePressure,
} from './state';

describe('isWorkerHeartbeatStale', () => {
  it('returns true when null', () => {
    expect(isWorkerHeartbeatStale(null)).toBe(true);
  });
  it('returns false for fresh heartbeat', () => {
    expect(isWorkerHeartbeatStale(new Date())).toBe(false);
  });
  it('returns true for old heartbeat', () => {
    expect(isWorkerHeartbeatStale(new Date(Date.now() - 300_000))).toBe(true);
  });
});

describe('queueFailurePressure', () => {
  it('flags degraded when many failures', () => {
    const r = queueFailurePressure({
      crawl: { failed: 30 },
      scan: { failed: 0 },
      cluster: { failed: 0 },
      remediation: { failed: 0 },
    });
    expect(r.degraded).toBe(true);
    expect(r.totalFailed).toBe(30);
  });
});

describe('deriveReadinessFromServices', () => {
  it('blocked when critical service failed', () => {
    const r = deriveReadinessFromServices([
      { id: 'database', criticality: 'critical', healthState: 'failed' },
    ]);
    expect(r.readiness).toBe('blocked');
    expect(r.blockers.length).toBeGreaterThan(0);
  });
  it('degraded when only warnings', () => {
    const r = deriveReadinessFromServices([
      { id: 'x', criticality: 'critical', healthState: 'degraded' },
      { id: 'y', criticality: 'critical', healthState: 'running' },
    ]);
    expect(r.readiness).toBe('degraded');
  });
});
