/**
 * System Posture Types
 *
 * Standardized health and degradation tracking across all repos.
 * Provides component-level decomposition with explicit fail-closed semantics.
 */

/**
 * Overall posture levels
 */
export type PostureLevel = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

/**
 * Component-specific states (domain-extensible)
 */
export type ComponentState =
  | 'ok'
  | 'healthy'
  | 'degraded'
  | 'unhealthy'
  | 'failed'
  | 'not_ready'
  | 'idle'
  | 'unknown'
  | 'disabled'
  | 'misconfigured';

/**
 * Individual component posture
 */
export interface ComponentPosture {
  id: string;
  name: string;
  level: PostureLevel;
  state: ComponentState;
  reasonCodes: string[];
  detail: string;
  checkedAt: string;
  lastActivityAt?: string;
  stale: boolean;
  staleThresholdMs?: number;
}

/**
 * System-wide posture aggregation
 */
export interface SystemPosture {
  overall: PostureLevel;
  summary: string;
  reasonCodes: string[];
  components: ComponentPosture[];
  degraded: boolean;
  degradedReasons: string[];
  failClosed: boolean;
  checkedAt: string;
}

/**
 * Thresholds for determining degradation
 */
export interface DegradationThresholds {
  /** Error rate percentage that triggers degradation */
  errorRatePercent: number;
  /** Age in ms before component is considered stale */
  staleAgeMs: number;
  /** Number of failures before marking degraded */
  failureCount: number;
  /** Whether any critical component failure marks system unhealthy */
  criticalComponentFailed: boolean;
  /** Ratio of degraded components that marks system degraded (0.5 = 50%) */
  degradedComponentRatio: number;
  /** Whether any critical component being degraded marks system degraded */
  anyCriticalDegraded: boolean;
}

/**
 * Default degradation thresholds
 */
export const DEFAULT_DEGRADATION_THRESHOLDS: DegradationThresholds = {
  errorRatePercent: 5,
  staleAgeMs: 120000, // 2 minutes
  failureCount: 10,
  criticalComponentFailed: true,
  degradedComponentRatio: 0.5,
  anyCriticalDegraded: true,
};

/**
 * Component criticality levels
 */
export type ComponentCriticality = 'critical' | 'high' | 'medium' | 'low' | 'optional';

/**
 * Component definition with metadata
 */
export interface ComponentDefinition {
  id: string;
  name: string;
  criticality: ComponentCriticality;
  category: string;
  dependencies?: string[];
}

/**
 * Build a component posture from current state
 */
export function buildComponentPosture(
  definition: ComponentDefinition,
  state: ComponentState,
  detail: string,
  opts?: {
    lastActivityAt?: string;
    staleThresholdMs?: number;
    reasonCodes?: string[];
    traceId?: string;
  }
): ComponentPosture {
  const checkedAt = new Date().toISOString();
  const lastActivityAt = opts?.lastActivityAt ?? checkedAt;
  const staleThresholdMs = opts?.staleThresholdMs ?? DEFAULT_DEGRADATION_THRESHOLDS.staleAgeMs;

  const level = componentStateToLevel(state);
  const stale = Date.now() - new Date(lastActivityAt).getTime() > staleThresholdMs;

  const reasonCodes = opts?.reasonCodes ?? [];
  if (stale) reasonCodes.push('STALE_EVIDENCE');
  if (state === 'degraded') reasonCodes.push('DEGRADED_STATE');
  if (state === 'failed') reasonCodes.push('COMPONENT_FAILED');

  return {
    id: definition.id,
    name: definition.name,
    level,
    state,
    reasonCodes,
    detail,
    checkedAt,
    lastActivityAt,
    stale,
    staleThresholdMs,
  };
}

/**
 * Convert component state to posture level
 */
export function componentStateToLevel(state: ComponentState): PostureLevel {
  switch (state) {
    case 'ok':
    case 'healthy':
      return 'healthy';
    case 'degraded':
    case 'idle':
    case 'misconfigured':
      return 'degraded';
    case 'failed':
    case 'unhealthy':
    case 'not_ready':
      return 'unhealthy';
    case 'unknown':
    case 'disabled':
    default:
      return 'unknown';
  }
}

/**
 * Aggregate component postures into system posture
 */
export function aggregatePosture(
  components: ComponentPosture[],
  definitions: ComponentDefinition[],
  opts?: {
    summary?: string;
    thresholds?: Partial<DegradationThresholds>;
    failClosed?: boolean;
    traceId?: string;
  }
): SystemPosture {
  const thresholds = { ...DEFAULT_DEGRADATION_THRESHOLDS, ...opts?.thresholds };
  const checkedAt = new Date().toISOString();

  // Build criticality map
  const criticalityMap = new Map(definitions.map(d => [d.id, d.criticality]));

  // Count states
  const unhealthyCount = components.filter(c => c.level === 'unhealthy').length;
  const degradedCount = components.filter(c => c.level === 'degraded').length;
  const unknownCount = components.filter(c => c.level === 'unknown').length;
  const criticalFailed = components.some(
    c => criticalityMap.get(c.id) === 'critical' && c.level === 'unhealthy'
  );
  const criticalDegraded = components.some(
    c => criticalityMap.get(c.id) === 'critical' && c.level === 'degraded'
  );

  // Determine overall posture
  let overall: PostureLevel = 'healthy';
  const reasonCodes: string[] = [];

  if (criticalFailed && thresholds.criticalComponentFailed) {
    overall = 'unhealthy';
    reasonCodes.push('CRITICAL_COMPONENT_FAILED');
  } else if (unhealthyCount > 0) {
    overall = 'degraded';
    reasonCodes.push('COMPONENT_UNHEALTHY');
  } else if (
    degradedCount / components.length >= thresholds.degradedComponentRatio ||
    (criticalDegraded && thresholds.anyCriticalDegraded)
  ) {
    overall = 'degraded';
    reasonCodes.push('DEGRADED_COMPONENT_RATIO');
  } else if (unknownCount > 0) {
    overall = 'degraded';
    reasonCodes.push('UNKNOWN_COMPONENT_STATE');
  }

  // Collect degraded reasons
  const degradedReasons = components
    .filter(c => c.level === 'degraded' || c.level === 'unhealthy')
    .flatMap(c => c.reasonCodes);

  // Generate summary if not provided
  const summary =
    opts?.summary ??
    (overall === 'healthy'
      ? `All ${components.length} components healthy`
      : overall === 'degraded'
      ? `${degradedCount} degraded, ${unhealthyCount} unhealthy out of ${components.length} components`
      : `System unhealthy: ${unhealthyCount} failed components`);

  return {
    overall,
    summary,
    reasonCodes: [...new Set([...reasonCodes, ...degradedReasons])],
    components,
    degraded: overall === 'degraded' || overall === 'unhealthy',
    degradedReasons: [...new Set(degradedReasons)],
    failClosed: opts?.failClosed ?? true,
    checkedAt,
  };
}

/**
 * Health score calculation
 */
export interface HealthScore {
  score: number; // 0-100
  level: PostureLevel;
  primaryReason: string;
  explanation: string[];
}

/**
 * Calculate a numeric health score from posture
 */
export function calculateHealthScore(posture: SystemPosture): HealthScore {
  const componentScores = posture.components.map(c => {
    switch (c.level) {
      case 'healthy':
        return 100;
      case 'degraded':
        return 50;
      case 'unhealthy':
        return 0;
      case 'unknown':
        return 25;
      default:
        return 0;
    }
  });

  const avgScore =
    componentScores.reduce((a, b) => a + b, 0) / componentScores.length || 0;

  return {
    score: Math.round(avgScore),
    level: posture.overall,
    primaryReason: posture.reasonCodes[0] ?? 'NO_ISSUES',
    explanation: posture.degradedReasons,
  };
}

/**
 * Posture evaluation result with readiness determination
 */
export interface ReadinessResult {
  ready: boolean;
  posture: SystemPosture;
  blockers: string[];
  warnings: string[];
}

/**
 * Determine readiness from posture
 */
export function determineReadiness(
  posture: SystemPosture,
  opts?: {
    allowDegraded?: boolean;
    requiredComponents?: string[];
  }
): ReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (posture.overall === 'unhealthy') {
    blockers.push('System posture is unhealthy');
  }

  if (posture.overall === 'degraded' && !opts?.allowDegraded) {
    blockers.push('System posture is degraded (degraded not allowed)');
  } else if (posture.overall === 'degraded') {
    warnings.push('System operating in degraded mode');
  }

  // Check required components
  if (opts?.requiredComponents) {
    for (const requiredId of opts.requiredComponents) {
      const component = posture.components.find(c => c.id === requiredId);
      if (!component) {
        blockers.push(`Required component ${requiredId} not found`);
      } else if (component.level === 'unhealthy') {
        blockers.push(`Required component ${requiredId} is unhealthy`);
      } else if (component.level === 'degraded') {
        warnings.push(`Required component ${requiredId} is degraded`);
      }
    }
  }

  return {
    ready: blockers.length === 0,
    posture,
    blockers,
    warnings,
  };
}

/**
 * Create a degraded posture for a single component
 */
export function degradedPosture(
  componentId: string,
  componentName: string,
  reason: string,
  opts?: { traceId?: string; detail?: string }
): SystemPosture {
  const component: ComponentPosture = {
    id: componentId,
    name: componentName,
    level: 'degraded',
    state: 'degraded',
    reasonCodes: ['DEGRADED_BY_DESIGN'],
    detail: opts?.detail ?? reason,
    checkedAt: new Date().toISOString(),
    stale: false,
  };

  return {
    overall: 'degraded',
    summary: reason,
    reasonCodes: ['DEGRADED_BY_DESIGN'],
    components: [component],
    degraded: true,
    degradedReasons: [reason],
    failClosed: true,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Create an unhealthy posture (fail-closed)
 */
export function unhealthyPosture(
  componentId: string,
  componentName: string,
  reason: string,
  opts?: { traceId?: string; detail?: string }
): SystemPosture {
  const component: ComponentPosture = {
    id: componentId,
    name: componentName,
    level: 'unhealthy',
    state: 'failed',
    reasonCodes: ['FAIL_CLOSED'],
    detail: opts?.detail ?? reason,
    checkedAt: new Date().toISOString(),
    stale: false,
  };

  return {
    overall: 'unhealthy',
    summary: `FAIL CLOSED: ${reason}`,
    reasonCodes: ['FAIL_CLOSED'],
    components: [component],
    degraded: true,
    degradedReasons: [reason, 'FAIL_CLOSED'],
    failClosed: true,
    checkedAt: new Date().toISOString(),
  };
}