import type { PlatformHealthReport, PlatformReadiness } from './types';

/** Safe, route-consumable projection of platform health (no secrets; no raw env values). */
export type RoutePlatformShellBlocker =
  | 'none'
  | 'install_required'
  | 'deployment_misconfigured'
  | 'critical_dependency_down';

export interface RoutePlatformTruth {
  checkedAt: string;
  shellBlocker: RoutePlatformShellBlocker;
  /**
   * When true, org-scoped Prisma reads are expected to work; routes should use degraded/partial envelopes
   * instead of hard-failing. When false, prefer a single critical banner + minimal safe UI.
   */
  allowOrgScopedDbReads: boolean;
  readiness: PlatformReadiness;
  installed: boolean;
  /** User-safe, minimal lines for shell / banners (no env keys, hostnames, or secrets). */
  userImpactSummary: string[];
  /** Operator-oriented lines; still no secret values — use /system for detail. */
  operatorRemediationHints: string[];
  flags: {
    databaseOk: boolean;
    redisOk: boolean;
    sessionOk: boolean;
    envConfigOk: boolean;
    workerRunning: boolean;
    jobPipelinesHealthy: boolean;
  };
  /** Human-readable labels for optional services that are down or misconfigured (for user-safe copy). */
  optionalSubsystemIssues: string[];
}

function serviceById(report: PlatformHealthReport, id: string) {
  return report.services.find((s) => s.id === id);
}

/**
 * Derives route / shell semantics from the canonical health report.
 * Callers must pass the real report from collectPlatformHealth — do not fabricate readiness.
 */
export function buildRoutePlatformTruth(report: PlatformHealthReport): RoutePlatformTruth {
  const appApi = serviceById(report, 'app-api');
  const database = serviceById(report, 'database');
  const redis = serviceById(report, 'redis-queue');
  const worker = serviceById(report, 'worker-runtime');
  const pipelines = serviceById(report, 'job-pipelines');
  const envConfigOk = appApi?.healthState === 'ready' || appApi?.healthState === 'running';
  const databaseOk = report.dependencies.database.ok;
  const redisOk = report.dependencies.redis.ok;
  const sessionOk = report.dependencies.sessionStore.ok;
  const workerRunning = worker?.healthState === 'running';
  const jobPipelinesHealthy =
    pipelines?.healthState === 'running' || pipelines?.healthState === 'degraded';

  const optionalSubsystemIssues = report.services
    .filter((s) => s.criticality === 'optional' && s.enabled)
    .filter((s) =>
      ['unavailable', 'failed', 'misconfigured', 'degraded'].includes(s.healthState)
    )
    .map((s) => s.name);

  const userImpactSummary: string[] = [];
  const operatorRemediationHints: string[] = [];

  if (!databaseOk) {
    userImpactSummary.push('The database is not reachable. Saved data cannot be loaded until it is restored.');
    operatorRemediationHints.push('Verify DATABASE_URL and database availability; run migrations after connectivity is restored.');
  }

  if (!sessionOk && databaseOk) {
    userImpactSummary.push('Sign-in and sessions may not work correctly until configuration is fixed.');
    operatorRemediationHints.push('Sessions require a healthy database and valid auth environment variables.');
  }

  if (!report.bootstrap.installed && databaseOk) {
    userImpactSummary.push('Platform installation is not complete in the database.');
    operatorRemediationHints.push('Run database migrations and seed (for example: npm run db:migrate && npm run db:seed).');
  }

  if (report.bootstrap.readiness === 'blocked' && databaseOk && report.bootstrap.installed) {
    userImpactSummary.push('A core platform dependency is failing; background jobs and some features may not run.');
    operatorRemediationHints.push(
      ...report.bootstrap.blockers.map((b) => `Blocker: ${b}`),
      'Open System & core services for live service status and next steps.'
    );
  } else if (report.bootstrap.readiness === 'degraded' && databaseOk) {
    userImpactSummary.push('Some platform components are degraded; the app remains usable where data is available.');
    operatorRemediationHints.push(
      ...report.bootstrap.warnings.map((w) => `Warning: ${w}`),
      'Review System & core services for details.'
    );
  }

  if (databaseOk && redisOk && !workerRunning && report.bootstrap.installed) {
    userImpactSummary.push('Background workers are not running; crawls and queued jobs will not process.');
    operatorRemediationHints.push('Start the worker process (for example: npm run dev:worker) and ensure Redis is available.');
  }

  if (optionalSubsystemIssues.length > 0) {
    userImpactSummary.push('One or more optional integrations are unavailable; core scanning may still work.');
  }

  let shellBlocker: RoutePlatformShellBlocker = 'none';

  if (!databaseOk || !sessionOk) {
    shellBlocker = 'critical_dependency_down';
  } else if (!report.bootstrap.installed) {
    shellBlocker = 'install_required';
  } else if (!envConfigOk || report.bootstrap.readiness === 'blocked') {
    shellBlocker = 'deployment_misconfigured';
  }

  const allowOrgScopedDbReads = databaseOk && sessionOk;

  return {
    checkedAt: report.checkedAt,
    shellBlocker,
    allowOrgScopedDbReads,
    readiness: report.bootstrap.readiness,
    installed: report.bootstrap.installed,
    userImpactSummary,
    operatorRemediationHints,
    flags: {
      databaseOk,
      redisOk,
      sessionOk,
      envConfigOk,
      workerRunning,
      jobPipelinesHealthy,
    },
    optionalSubsystemIssues,
  };
}
