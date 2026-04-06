import type { PlatformHealthReport } from './types';

/** Minimal, operator-safe payload for unauthenticated load balancers (no secrets, no config details). */
export function toPublicHealthSummary(report: PlatformHealthReport) {
  const worker = report.services.find((s) => s.id === 'worker-runtime');
  const pipelines = report.services.find((s) => s.id === 'job-pipelines');

  const workerOk = worker?.healthState === 'running';
  const pipelinesOk =
    pipelines?.healthState === 'running' || pipelines?.healthState === 'degraded';

  const ready =
    report.bootstrap.installed &&
    report.dependencies.database.ok &&
    report.dependencies.redis.ok &&
    report.dependencies.sessionStore.ok &&
    workerOk &&
    pipelinesOk;

  return {
    checkedAt: report.checkedAt,
    live: true,
    installed: report.bootstrap.installed,
    readiness: report.bootstrap.readiness,
    ready,
    checks: {
      database: report.dependencies.database.ok,
      redis: report.dependencies.redis.ok,
      session: report.dependencies.sessionStore.ok,
      outboundEmail: report.dependencies.outboundEmail.ok,
      worker: workerOk,
      jobPipelines: pipelinesOk,
      abuseRateLimiting: report.dependencies.redis.ok
        ? 'redis_distributed'
        : 'memory_fallback_per_process',
    },
  };
}
