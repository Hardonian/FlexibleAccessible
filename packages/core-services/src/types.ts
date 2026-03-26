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

/** Unified runtime + config posture for a registered service */
export type ServiceHealthState =
  | 'unavailable'
  | 'disabled'
  | 'misconfigured'
  | 'ready'
  | 'running'
  | 'degraded'
  | 'failed';

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

export type PlatformReadiness = 'not_installed' | 'blocked' | 'degraded' | 'ready';

export interface PlatformBootstrapStatus {
  installed: boolean;
  installedAt: string | null;
  bootstrapVersion: number;
  readiness: PlatformReadiness;
  blockers: string[];
  warnings: string[];
}

export type LiveInfraProbesMode = 'live' | 'skipped_build';

export interface PlatformHealthReport {
  checkedAt: string;
  /** When `skipped_build`, Postgres/Redis/queue were not probed (Next.js production build). */
  liveInfraProbes: LiveInfraProbesMode;
  bootstrap: PlatformBootstrapStatus;
  dependencies: {
    database: DependencyCheckResult;
    redis: DependencyCheckResult;
    sessionStore: DependencyCheckResult;
  };
  services: CoreServiceRuntimeView[];
  /**
   * Raw JSON from PlatformState.productFlags (non-secret operator prefs/acks).
   * Null when platform row missing or database unreachable.
   */
  operatorPlatformFlags: Record<string, unknown> | null;
}
