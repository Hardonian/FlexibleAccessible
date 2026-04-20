/**
 * Core Services Types
 * 
 * REFACTORED: Now using standardized patterns from @aros/shared
 * All new code should use StandardResult<T>, SystemPosture, etc.
 * 
 * @deprecated Legacy types are maintained for backward compatibility.
 * Migrate to standardized patterns: result.ts, posture.ts, verification.ts, auth.ts
 */

import {
  aggregatePosture,
  buildComponentPosture,
  failure,
  success,
  type ComponentCriticality,
  type ComponentPosture,
  type ComponentState,
  type PostureLevel,
  type StandardResult,
  type SystemPosture,
} from '@aros/shared';

// Re-export standardized types for convenience
export type {
  ResultState,
  ErrorDetails,
  ResultMetadata,
  StandardResult,
  PostureLevel,
  ComponentState,
  ComponentPosture,
  SystemPosture,
  DegradationThresholds,
  ComponentCriticality,
  ComponentDefinition,
  HealthScore,
  ReadinessResult,
  VerificationStatus,
  VerificationMethod,
  VerificationTargetType,
  VerificationTarget,
  VerificationEvidence,
  VerificationResultDetails,
  VerificationAttempt,
  VerificationConfig,
  Permission,
  ResourceType,
  UserRole,
  Resource,
  Grant,
  BlastRadiusClass,
} from '@aros/shared';

export {
  success,
  failure,
  isSuccess,
  isFailure,
  ResultAsync,
  DEFAULT_DEGRADATION_THRESHOLDS,
  buildComponentPosture,
  componentStateToLevel,
  aggregatePosture,
  calculateHealthScore,
  determineReadiness,
  degradedPosture,
  unhealthyPosture,
} from '@aros/shared';

// ==================== LEGACY TYPES (DEPRECATED) ====================

/** 
 * @deprecated Use ComponentCriticality from @aros/shared 
 * Migration: 'critical' | 'optional' -> 'critical' | 'high' | 'medium' | 'low' | 'optional'
 */
export type ServiceCriticality = 'critical' | 'optional';

export type ServiceCategory =
  | 'data'
  | 'queue'
  | 'auth'
  | 'billing'
  | 'integration'
  | 'ai'
  | 'storage';

export type ServiceScope = 'deployment' | 'organization';

/** 
 * @deprecated Use ComponentState from @aros/shared
 * Migration: ServiceHealthState maps to ComponentState
 */
export type ServiceHealthState =
  | 'unavailable'
  | 'disabled'
  | 'misconfigured'
  | 'ready'
  | 'running'
  | 'degraded'
  | 'failed';

/**
 * Maps legacy ServiceHealthState to standardized ComponentState
 */
export function toComponentState(state: ServiceHealthState): ComponentState {
  const mapping: Record<ServiceHealthState, ComponentState> = {
    'unavailable': 'unknown',
    'disabled': 'disabled',
    'misconfigured': 'misconfigured',
    'ready': 'ok',
    'running': 'ok',
    'degraded': 'degraded',
    'failed': 'failed',
  };
  return mapping[state] ?? 'unknown';
}

/**
 * Maps legacy ServiceCriticality to standardized ComponentCriticality
 */
export function toComponentCriticality(criticality: ServiceCriticality): ComponentCriticality {
  return criticality === 'critical' ? 'critical' : 'optional';
}

export interface CoreServiceDefinition {
  id: string;
  name: string;
  purpose: string;
  category: ServiceCategory;
  criticality: ServiceCriticality;
  scope: ServiceScope;
  /** When false, service is deployment-gated (not merely misconfigured) */
  userVisibleWhenDown: boolean;
}

/**
 * @deprecated Use standardized DependencyCheckResult or StandardResult pattern
 */
export interface DependencyCheckResult {
  ok: boolean;
  message?: string;
  checkedAt: string;
  /**
   * When true, no live connection was attempted (e.g. Next.js production build).
   * Callers should not treat `ok: false` as a production outage in this case.
   */
  skipped?: boolean;
}

/**
 * Converts legacy DependencyCheckResult to standardized pattern
 */
export function toStandardResult<T>(
  result: DependencyCheckResult,
  data?: T,
  traceId: string = 'legacy'
): StandardResult<T> {
  if (result.ok) {
    return success(data as T, {
      traceId,
      timestamp: result.checkedAt,
    });
  }
  return failure('unavailable', {
    message: result.message ?? 'Dependency check failed',
    code: 'DEPENDENCY_FAILED',
  }, {
    traceId,
    timestamp: result.checkedAt,
  });
}

export interface CoreServiceRuntimeView extends CoreServiceDefinition {
  enabled: boolean;
  configState: 'valid' | 'invalid' | 'partial';
  configIssues: string[];
  /** Non-sensitive summary only */
  configSummary: Record<string, string | boolean | number>;
  healthState: ServiceHealthState;
  lastCheckAt: string | null;
  lastActivityAt: string | null;
  failureReason: string | null;
  nextStep: string;
  dependencies: Record<string, DependencyCheckResult>;
}

/**
 * Converts CoreServiceRuntimeView to standardized ComponentPosture
 */
export function toComponentPosture(view: CoreServiceRuntimeView): ComponentPosture {
  return buildComponentPosture(
    {
      id: view.id,
      name: view.name,
      criticality: toComponentCriticality(view.criticality),
      category: view.category,
    },
    toComponentState(view.healthState),
    view.failureReason ?? view.nextStep,
    {
      lastActivityAt: view.lastActivityAt ?? undefined,
      reasonCodes: view.configIssues,
    }
  );
}

/** 
 * @deprecated Use ReadinessResult from @aros/shared
 */
export type PlatformReadiness = 'not_installed' | 'blocked' | 'degraded' | 'ready';

/**
 * Maps legacy PlatformReadiness to standardized PostureLevel
 */
export function toPostureLevel(readiness: PlatformReadiness): PostureLevel {
  const mapping: Record<PlatformReadiness, PostureLevel> = {
    'not_installed': 'unknown',
    'blocked': 'unhealthy',
    'degraded': 'degraded',
    'ready': 'healthy',
  };
  return mapping[readiness];
}

/**
 * @deprecated Use standardized bootstrap patterns
 */
export interface PlatformBootstrapStatus {
  installed: boolean;
  installedAt: string | null;
  bootstrapVersion: number;
  readiness: PlatformReadiness;
  blockers: string[];
  warnings: string[];
}

export type LiveInfraProbesMode = 'live' | 'skipped_build';

/** BullMQ queue depth snapshot (waiting / active / failed) when Redis is reachable. */
export interface JobQueueDepthRow {
  waiting: number;
  active: number;
  failed: number;
}

export interface JobQueueDepthSnapshot {
  crawl: JobQueueDepthRow;
  scan: JobQueueDepthRow;
  cluster: JobQueueDepthRow;
  remediation: JobQueueDepthRow;
  publicScan: JobQueueDepthRow;
  visualReview: JobQueueDepthRow;
}

/**
 * @deprecated Use SystemPosture from @aros/shared
 * Migration guide: PlatformHealthReport -> SystemPosture
 */
export interface PlatformHealthReport {
  checkedAt: string;
  /** When `skipped_build`, Postgres/Redis/queue were not probed (Next.js production build). */
  liveInfraProbes: LiveInfraProbesMode;
  bootstrap: PlatformBootstrapStatus;
  dependencies: {
    database: DependencyCheckResult;
    redis: DependencyCheckResult;
    sessionStore: DependencyCheckResult;
    /** True when SMTP_* + EMAIL_FROM are set for transactional mail (password reset, verification). */
    outboundEmail: DependencyCheckResult;
  };
  services: CoreServiceRuntimeView[];
  /**
   * Raw JSON from PlatformState.productFlags (non-secret operator prefs/acks).
   * Null when platform row missing or database unreachable.
   */
  operatorPlatformFlags: Record<string, unknown> | null;
  /**
   * Live BullMQ depths when infra probes ran and Redis accepted connections.
   * Omitted during `skipped_build` or when Redis was down / unreadable.
   */
  jobQueueDepths?: {
    checkedAt: string;
    snapshot: JobQueueDepthSnapshot;
  } | null;
}

/**
 * Converts PlatformHealthReport to standardized SystemPosture
 */
export function toSystemPosture(report: PlatformHealthReport):
SystemPosture {
  const components = report.services.map(toComponentPosture);
  const definitions = report.services.map((service) => ({
    id: service.id,
    name: service.name,
    criticality: toComponentCriticality(service.criticality),
    category: service.category,
  }));

  return aggregatePosture(components, definitions, {
    summary: `Platform readiness: ${report.bootstrap.readiness}`,
    failClosed: true,
  });
}
