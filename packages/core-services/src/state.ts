/**
 * Service State Management
 * 
 * REFACTORED: Now using standardized patterns from @aros/shared
 * - SystemPosture for health aggregation
 * - determineReadiness for readiness calculation
 * - Component-based decomposition
 */

import type {
  CoreServiceRuntimeView,
  JobQueueDepthSnapshot,
  PlatformBootstrapStatus,
} from './types';
import {
  type SystemPosture,
  type ComponentPosture,
  type ReadinessResult,
  type DegradationThresholds,
  aggregatePosture,
  determineReadiness,
  calculateHealthScore,
  toComponentState,
  toComponentCriticality,
  buildComponentPosture,
  DEFAULT_DEGRADATION_THRESHOLDS,
} from '@aros/shared';

const WORKER_STALE_MS = 120_000;
const FAILED_JOBS_WARNING = 25;

/**
 * Check if worker heartbeat is stale
 * Used to determine component freshness
 */
export function isWorkerHeartbeatStale(lastHeartbeatAt: Date | null | undefined): boolean {
  if (!lastHeartbeatAt) return true;
  return Date.now() - lastHeartbeatAt.getTime() > WORKER_STALE_MS;
}

/**
 * Calculate queue failure pressure
 * 
 * @deprecated Use calculateHealthScore with queue component posture instead
 */
export function queueFailurePressure(snapshot: JobQueueDepthSnapshot): {
  degraded: boolean;
  totalFailed: number;
} {
  const totalFailed =
    snapshot.crawl.failed +
    snapshot.scan.failed +
    snapshot.cluster.failed +
    snapshot.remediation.failed +
    snapshot.publicScan.failed +
    snapshot.visualReview.failed;
  return { degraded: totalFailed >= FAILED_JOBS_WARNING, totalFailed };
}

/**
 * Convert JobQueueDepthSnapshot to queue component posture
 * 
 * @param snapshot - Queue depth snapshot
 * @returns ComponentPosture for BullMQ queues
 */
export function toQueueComponentPosture(
  snapshot: JobQueueDepthSnapshot
): ComponentPosture {
  const totalFailed =
    snapshot.crawl.failed +
    snapshot.scan.failed +
    snapshot.cluster.failed +
    snapshot.remediation.failed +
    snapshot.publicScan.failed +
    snapshot.visualReview.failed;

  const state = totalFailed >= FAILED_JOBS_WARNING ? 'degraded' : 'ok';
  const reasonCodes = totalFailed >= FAILED_JOBS_WARNING ? ['HIGH_FAILED_JOB_COUNT'] : [];

  return buildComponentPosture(
    {
      id: 'bullmq',
      name: 'BullMQ Job Queues',
      criticality: 'critical',
      category: 'queue',
    },
    state,
    totalFailed >= FAILED_JOBS_WARNING
      ? `${totalFailed} failed jobs across all queues`
      : 'Queue depths within normal limits',
    {
      reasonCodes,
    }
  );
}

/**
 * Convert CoreServiceRuntimeView to standardized ComponentPosture
 * 
 * @param service - Runtime view of service
 * @returns Standardized component posture
 */
export function serviceToComponentPosture(
  service: Pick<CoreServiceRuntimeView, 'id' | 'name' | 'criticality' | 'healthState' | 'lastActivityAt'>
): ComponentPosture {
  return buildComponentPosture(
    {
      id: service.id,
      name: service.name,
      criticality: toComponentCriticality(service.criticality),
      category: 'data', // Default, should be passed in
    },
    toComponentState(service.healthState),
    `Service ${service.healthState}`,
    {
      lastActivityAt: service.lastActivityAt ?? undefined,
    }
  );
}

/**
 * Build SystemPosture from array of service runtime views
 * 
 * @param services - Array of service runtime views
 * @param opts - Optional configuration
 * @returns Standardized SystemPosture
 */
export function buildSystemPostureFromServices(
  services: CoreServiceRuntimeView[],
  opts?: {
    thresholds?: Partial<DegradationThresholds>;
    queueSnapshot?: JobQueueDepthSnapshot;
  }
): SystemPosture {
  const components: ComponentPosture[] = services.map(serviceToComponentPosture);

  // Add queue component if snapshot provided
  if (opts?.queueSnapshot) {
    components.push(toQueueComponentPosture(opts.queueSnapshot));
  }

  // Build definitions from services
  const definitions = services.map(s => ({
    id: s.id,
    name: s.name,
    criticality: toComponentCriticality(s.criticality),
    category: s.category,
  }));

  // Add queue definition
  if (opts?.queueSnapshot) {
    definitions.push({
      id: 'bullmq',
      name: 'BullMQ Job Queues',
      criticality: 'critical',
      category: 'queue',
    });
  }

  return aggregatePosture(components, definitions, {
    thresholds: opts?.thresholds,
    failClosed: true,
  });
}

/**
 * Derive readiness from services using standardized patterns
 * 
 * REFACTORED: Now uses determineReadiness from @aros/shared
 * 
 * @param services - Array of service runtime views
 * @returns PlatformBootstrapStatus with readiness info
 */
export function deriveReadinessFromServices(
  services: Pick<CoreServiceRuntimeView, 'id' | 'criticality' | 'healthState'>[]
): Pick<PlatformBootstrapStatus, 'readiness' | 'blockers' | 'warnings'> {
  // Convert to standardized posture
  const components = services.map(s => 
    buildComponentPosture(
      {
        id: s.id,
        name: s.id,
        criticality: toComponentCriticality(s.criticality),
        category: 'data',
      },
      toComponentState(s.healthState),
      `Service ${s.healthState}`
    )
  );

  const definitions = services.map(s => ({
    id: s.id,
    name: s.id,
    criticality: toComponentCriticality(s.criticality),
    category: 'data',
  }));

  const posture = aggregatePosture(components, definitions, { failClosed: true });
  const readinessResult = determineReadiness(posture);

  return {
    readiness: readinessResult.ready ? 'ready' : 
               posture.overall === 'degraded' ? 'degraded' : 'blocked',
    blockers: readinessResult.blockers,
    warnings: readinessResult.warnings,
  };
}

/**
 * Get comprehensive readiness result with full posture
 * 
 * NEW: Returns full standardized ReadinessResult
 * 
 * @param services - Array of service runtime views
 * @param opts - Optional queue snapshot
 * @returns Full ReadinessResult with SystemPosture
 */
export function getReadinessResult(
  services: CoreServiceRuntimeView[],
  opts?: { queueSnapshot?: JobQueueDepthSnapshot }
): ReadinessResult {
  const posture = buildSystemPostureFromServices(services, {
    queueSnapshot: opts?.queueSnapshot,
  });

  return determineReadiness(posture, { allowDegraded: true });
}

/**
 * Calculate health score from services and queues
 * 
 * NEW: Returns numeric health score for dashboards
 * 
 * @param services - Array of service runtime views
 * @param opts - Optional queue snapshot
 * @returns HealthScore with 0-100 score
 */
export function calculateServiceHealthScore(
  services: CoreServiceRuntimeView[],
  opts?: { queueSnapshot?: JobQueueDepthSnapshot }
): ReturnType<typeof calculateHealthScore> {
  const posture = buildSystemPostureFromServices(services, {
    queueSnapshot: opts?.queueSnapshot,
  });

  return calculateHealthScore(posture);
}

