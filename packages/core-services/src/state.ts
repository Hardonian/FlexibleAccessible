import type { CoreServiceRuntimeView, PlatformBootstrapStatus, PlatformReadiness } from './types';

const WORKER_STALE_MS = 120_000;
const FAILED_JOBS_WARNING = 25;

export function isWorkerHeartbeatStale(lastHeartbeatAt: Date | null | undefined): boolean {
  if (!lastHeartbeatAt) return true;
  return Date.now() - lastHeartbeatAt.getTime() > WORKER_STALE_MS;
}

export function queueFailurePressure(snapshot: {
  crawl: { failed: number };
  scan: { failed: number };
  cluster: { failed: number };
  remediation: { failed: number };
}): { degraded: boolean; totalFailed: number } {
  const totalFailed =
    snapshot.crawl.failed + snapshot.scan.failed + snapshot.cluster.failed + snapshot.remediation.failed;
  return { degraded: totalFailed >= FAILED_JOBS_WARNING, totalFailed };
}

export function deriveReadinessFromServices(
  services: Pick<CoreServiceRuntimeView, 'id' | 'criticality' | 'healthState'>[]
): Pick<PlatformBootstrapStatus, 'readiness' | 'blockers' | 'warnings'> {
  const blockers: string[] = [];
  const warnings: string[] = [];

  for (const s of services) {
    if (s.criticality !== 'critical') continue;
    if (s.healthState === 'failed' || s.healthState === 'unavailable' || s.healthState === 'misconfigured') {
      blockers.push(`${s.id}: ${s.healthState}`);
    } else if (s.healthState === 'degraded') {
      warnings.push(`${s.id} is degraded`);
    }
  }

  let readiness: PlatformReadiness = 'ready';
  if (blockers.length > 0) {
    readiness = 'blocked';
  } else if (warnings.length > 0) {
    readiness = 'degraded';
  }

  return { readiness, blockers, warnings };
}
