import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { collectPlatformHealth } from './orchestrator';
import type { PrismaClient } from '@aros/db';

vi.mock('./checks', () => ({
  checkPostgres: vi.fn().mockResolvedValue({ ok: true, checkedAt: 't' }),
  checkRedisPing: vi.fn().mockResolvedValue({ ok: true, checkedAt: 't' }),
  getQueueDepths: vi.fn().mockResolvedValue({
    ok: true,
    checkedAt: 't',
    snapshot: {
      crawl: { waiting: 0, active: 0, failed: 0 },
      scan: { waiting: 0, active: 0, failed: 0 },
      cluster: { waiting: 0, active: 0, failed: 0 },
      remediation: { waiting: 0, active: 0, failed: 0 },
    },
  }),
}));

vi.mock('@aros/config', () => ({
  parseEnvDiagnostics: vi.fn().mockReturnValue({ valid: true, fieldErrors: {}, issues: [] }),
}));

describe('collectPlatformHealth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-22T12:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports not_installed when platform row missing', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
      platformState: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaClient;

    const report = await collectPlatformHealth(prisma);
    expect(report.bootstrap.installed).toBe(false);
    expect(report.bootstrap.readiness).toBe('not_installed');
    expect(report.operatorPlatformFlags).toBeNull();
  });

  it('marks worker running when heartbeat is fresh', async () => {
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
      platformState: {
        findUnique: vi.fn().mockResolvedValue({
          installedAt: new Date('2025-01-01T00:00:00.000Z'),
          bootstrapVersion: 1,
          workerLastHeartbeatAt: new Date('2025-03-22T11:59:30.000Z'),
          productFlags: {},
        }),
      },
    } as unknown as PrismaClient;

    const report = await collectPlatformHealth(prisma);
    const worker = report.services.find((s) => s.id === 'worker-runtime');
    expect(worker?.healthState).toBe('running');
    expect(report.operatorPlatformFlags).toEqual({});
  });
});
