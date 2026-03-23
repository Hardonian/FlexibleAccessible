import type { CoreServiceRuntimeView, PlatformHealthReport, ServiceHealthState } from './types';

export type DiagnosticSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type RemediationType =
  | 'in_app'
  | 'deployment_env'
  | 'dependency_recovery'
  | 'bootstrap_completion'
  | 'retry_recheck'
  | 'permission'
  | 'documentation';

export type ActorResponsibility = 'platform_operator' | 'deployment_engineer' | 'org_admin' | 'end_user_unaffected';

export interface OperatorProductFlags {
  /** Optional service diagnostic IDs suppressed from critical/warning banners (deployment-wide). */
  suppressedOptionalDiagnosticIds: string[];
}

export interface OperatorAcknowledgements {
  /** Diagnostic issue IDs acknowledged by an operator (does not change underlying health). */
  acknowledgedIssueIds: string[];
  updatedAt: string | null;
}

export interface ParsedOperatorPlatformFlags {
  prefs: OperatorProductFlags;
  acknowledgements: OperatorAcknowledgements;
}

export interface PlatformSetupStep {
  id: string;
  title: string;
  detail: string;
  done: boolean;
  blocking: boolean;
  fixRemediationType: RemediationType;
  fixInProduct: boolean;
}

export interface PlatformDiagnosticIssue {
  id: string;
  code: string;
  target: { kind: 'service' | 'bootstrap' | 'dependency' | 'platform'; id: string };
  severity: DiagnosticSeverity;
  stateCategory: ServiceHealthState | 'bootstrap' | 'dependency' | 'environment';
  summary: string;
  impactUser: string;
  impactOperator: string;
  recommendedNextStep: string;
  remediationType: RemediationType;
  fixInProduct: boolean;
  requiresDeployOrInfra: boolean;
  retrySafe: boolean;
  evidence: string[];
  lastCheckedAt: string;
  blocksReadiness: boolean;
  appUsable: boolean;
  canOperatorContinueSafely: boolean;
  whoShouldAct: ActorResponsibility;
  acknowledged: boolean;
  suppressedFromBanner: boolean;
}

export interface OperatorActionDescriptor {
  id: string;
  label: string;
  description: string;
  method: 'POST' | 'PATCH';
  pathSuffix: string;
  /** When false, UI should not offer the action (e.g. wrong permission tier). */
  available: boolean;
}

export interface ControlPlaneSummary {
  criticalBlockers: PlatformDiagnosticIssue[];
  warnings: PlatformDiagnosticIssue[];
  recoverableIssues: PlatformDiagnosticIssue[];
  optionalUnavailable: PlatformDiagnosticIssue[];
  acknowledgedIssues: PlatformDiagnosticIssue[];
}

const DEFAULT_FLAGS: ParsedOperatorPlatformFlags = {
  prefs: { suppressedOptionalDiagnosticIds: [] },
  acknowledgements: { acknowledgedIssueIds: [], updatedAt: null },
};

export function parseOperatorPlatformFlags(raw: unknown): ParsedOperatorPlatformFlags {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_FLAGS, prefs: { ...DEFAULT_FLAGS.prefs }, acknowledgements: { ...DEFAULT_FLAGS.acknowledgements } };
  }
  const o = raw as Record<string, unknown>;
  const op = o.operatorPrefs;
  const oa = o.operatorAcknowledgements;
  const suppressed =
    op &&
    typeof op === 'object' &&
    !Array.isArray(op) &&
    Array.isArray((op as { suppressedOptionalDiagnosticIds?: unknown }).suppressedOptionalDiagnosticIds)
      ? ((op as { suppressedOptionalDiagnosticIds: string[] }).suppressedOptionalDiagnosticIds.filter(
          (x) => typeof x === 'string'
        ) as string[])
      : [];
  const ackIds =
    oa &&
    typeof oa === 'object' &&
    !Array.isArray(oa) &&
    Array.isArray((oa as { acknowledgedIssueIds?: unknown }).acknowledgedIssueIds)
      ? ((oa as { acknowledgedIssueIds: string[] }).acknowledgedIssueIds.filter((x) => typeof x === 'string') as string[])
      : [];
  const updatedAt =
    oa &&
    typeof oa === 'object' &&
    typeof (oa as { updatedAt?: unknown }).updatedAt === 'string'
      ? ((oa as { updatedAt: string }).updatedAt as string)
      : null;
  return {
    prefs: { suppressedOptionalDiagnosticIds: suppressed },
    acknowledgements: { acknowledgedIssueIds: ackIds, updatedAt },
  };
}

export function serializeOperatorPlatformFlags(parsed: ParsedOperatorPlatformFlags): Record<string, unknown> {
  return {
    operatorPrefs: {
      suppressedOptionalDiagnosticIds: parsed.prefs.suppressedOptionalDiagnosticIds,
    },
    operatorAcknowledgements: {
      acknowledgedIssueIds: parsed.acknowledgements.acknowledgedIssueIds,
      updatedAt: parsed.acknowledgements.updatedAt,
    },
  };
}

function severityForService(svc: CoreServiceRuntimeView): DiagnosticSeverity {
  if (svc.criticality === 'critical') {
    if (svc.healthState === 'unavailable' || svc.healthState === 'failed' || svc.healthState === 'misconfigured') {
      return 'critical';
    }
    if (svc.healthState === 'degraded') return 'high';
  } else {
    if (svc.healthState === 'misconfigured') return 'medium';
    if (svc.healthState === 'failed' || svc.healthState === 'unavailable') return 'medium';
    if (svc.healthState === 'degraded') return 'low';
  }
  return 'info';
}

function remediationForService(svc: CoreServiceRuntimeView): {
  remediationType: RemediationType;
  fixInProduct: boolean;
  requiresDeployOrInfra: boolean;
  retrySafe: boolean;
  who: ActorResponsibility;
} {
  const deployHeavy = ['app-api', 'database', 'redis-queue', 'worker-runtime', 'job-pipelines', 'session-auth'].includes(
    svc.id
  );

  if (deployHeavy) {
    const retry = ['worker-runtime', 'job-pipelines'].includes(svc.id);
    return {
      remediationType: svc.healthState === 'misconfigured' ? 'deployment_env' : 'dependency_recovery',
      fixInProduct: false,
      requiresDeployOrInfra: true,
      retrySafe: retry,
      who: 'deployment_engineer',
    };
  }

  if (svc.criticality === 'optional') {
    return {
      remediationType: 'deployment_env',
      fixInProduct: false,
      requiresDeployOrInfra: true,
      retrySafe: true,
      who: 'deployment_engineer',
    };
  }

  return {
    remediationType: 'documentation',
    fixInProduct: false,
    requiresDeployOrInfra: true,
    retrySafe: false,
    who: 'platform_operator',
  };
}

function appUsableFromReport(report: PlatformHealthReport): boolean {
  const db = report.dependencies.database.ok;
  const session = report.dependencies.sessionStore.ok;
  const installed = report.bootstrap.installed;
  return db && session && installed;
}

function issueFromService(report: PlatformHealthReport, svc: CoreServiceRuntimeView): PlatformDiagnosticIssue | null {
  if (svc.id === 'database' && !report.dependencies.database.ok) return null;
  if (svc.id === 'redis-queue' && !report.dependencies.redis.ok) return null;
  if (svc.id === 'session-auth' && !report.dependencies.sessionStore.ok) return null;
  if (svc.id === 'worker-runtime' && !report.dependencies.redis.ok) return null;
  if (
    svc.id === 'job-pipelines' &&
    (!report.dependencies.redis.ok || !report.dependencies.database.ok)
  ) {
    return null;
  }

  const okStates: ServiceHealthState[] = ['ready', 'running', 'disabled'];
  if (okStates.includes(svc.healthState)) return null;
  if (svc.criticality === 'optional' && svc.healthState === 'disabled') return null;

  const { remediationType, fixInProduct, requiresDeployOrInfra, retrySafe, who } = remediationForService(svc);
  const severity = severityForService(svc);
  const blocks = svc.criticality === 'critical' && !['ready', 'running', 'disabled'].includes(svc.healthState);
  const usable = appUsableFromReport(report);
  const evidence: string[] = [];
  if (svc.failureReason) evidence.push(svc.failureReason);
  if (svc.configIssues.length) evidence.push(...svc.configIssues);
  evidence.push(`healthState=${svc.healthState}`, `criticality=${svc.criticality}`);

  const impactUser =
    svc.criticality === 'critical'
      ? 'End users may see errors, missing data, or failed background work for core features.'
      : 'Core scanning and findings are unaffected; this integration or enhancement may be unavailable.';

  const impactOperator =
    who === 'deployment_engineer'
      ? 'Requires deployment configuration, infrastructure, or process changes outside this screen.'
      : 'Can be addressed from organization settings or in-app workflows where applicable.';

  return {
    id: `svc:${svc.id}`,
    code: `SVC_${svc.id.replace(/-/g, '_').toUpperCase()}`,
    target: { kind: 'service', id: svc.id },
    severity,
    stateCategory: svc.healthState,
    summary: svc.failureReason ?? `${svc.name} is ${svc.healthState.replace(/_/g, ' ')}`,
    impactUser,
    impactOperator,
    recommendedNextStep: svc.nextStep,
    remediationType,
    fixInProduct,
    requiresDeployOrInfra,
    retrySafe,
    evidence,
    lastCheckedAt: svc.lastCheckAt ?? report.checkedAt,
    blocksReadiness: blocks,
    appUsable: usable && !blocks,
    canOperatorContinueSafely: usable,
    whoShouldAct: who,
    acknowledged: false,
    suppressedFromBanner: false,
  };
}

function bootstrapIssues(report: PlatformHealthReport): PlatformDiagnosticIssue[] {
  const out: PlatformDiagnosticIssue[] = [];
  const checkedAt = report.checkedAt;
  if (!report.bootstrap.installed) {
    out.push({
      id: 'bootstrap:not_installed',
      code: 'BOOTSTRAP_NOT_INSTALLED',
      target: { kind: 'bootstrap', id: 'platform' },
      severity: 'critical',
      stateCategory: 'bootstrap',
      summary: 'Platform installation row is missing in the database.',
      impactUser: 'The product cannot reliably persist organization data until installation completes.',
      impactOperator: 'Run migrations and seed/bootstrap so PlatformState exists.',
      recommendedNextStep: report.bootstrap.blockers[0] ?? 'Run npm run db:migrate && npm run db:seed && npm run bootstrap.',
      remediationType: 'bootstrap_completion',
      fixInProduct: false,
      requiresDeployOrInfra: true,
      retrySafe: true,
      evidence: [...report.bootstrap.blockers],
      lastCheckedAt: checkedAt,
      blocksReadiness: true,
      appUsable: false,
      canOperatorContinueSafely: false,
      whoShouldAct: 'deployment_engineer',
      acknowledged: false,
      suppressedFromBanner: false,
    });
    return out;
  }

  for (const b of report.bootstrap.blockers) {
    out.push({
      id: `bootstrap:blocker:${hashStable(b)}`,
      code: 'BOOTSTRAP_BLOCKER',
      target: { kind: 'bootstrap', id: 'platform' },
      severity: 'critical',
      stateCategory: 'bootstrap',
      summary: b,
      impactUser: 'Core platform subsystems are failing; some features and jobs will not run correctly.',
      impactOperator: 'Resolve the failing dependency or service, then use Recheck readiness on the System page.',
      recommendedNextStep: 'Follow the next-step guidance for the affected core service below.',
      remediationType: 'dependency_recovery',
      fixInProduct: false,
      requiresDeployOrInfra: true,
      retrySafe: true,
      evidence: [b],
      lastCheckedAt: checkedAt,
      blocksReadiness: true,
      appUsable: appUsableFromReport(report),
      canOperatorContinueSafely: appUsableFromReport(report),
      whoShouldAct: 'deployment_engineer',
      acknowledged: false,
      suppressedFromBanner: false,
    });
  }

  for (const w of report.bootstrap.warnings) {
    out.push({
      id: `bootstrap:warning:${hashStable(w)}`,
      code: 'BOOTSTRAP_WARNING',
      target: { kind: 'bootstrap', id: 'platform' },
      severity: 'medium',
      stateCategory: 'bootstrap',
      summary: w,
      impactUser: 'Some workflows may be slower, fail intermittently, or lack optional capabilities.',
      impactOperator: 'Review the linked service; optional issues can be acknowledged if accepted.',
      recommendedNextStep: 'Inspect the degraded service and deployment logs.',
      remediationType: 'dependency_recovery',
      fixInProduct: false,
      requiresDeployOrInfra: true,
      retrySafe: true,
      evidence: [w],
      lastCheckedAt: checkedAt,
      blocksReadiness: false,
      appUsable: true,
      canOperatorContinueSafely: true,
      whoShouldAct: 'deployment_engineer',
      acknowledged: false,
      suppressedFromBanner: false,
    });
  }

  return out;
}

function dependencyIssues(report: PlatformHealthReport): PlatformDiagnosticIssue[] {
  const out: PlatformDiagnosticIssue[] = [];
  const t = report.checkedAt;
  if (!report.dependencies.database.ok) {
    out.push({
      id: 'dep:database',
      code: 'DEP_POSTGRES',
      target: { kind: 'dependency', id: 'database' },
      severity: 'critical',
      stateCategory: 'dependency',
      summary: report.dependencies.database.message ?? 'PostgreSQL is not reachable.',
      impactUser: 'Sign-in, sites, findings, and settings cannot load reliably.',
      impactOperator: 'Restore database connectivity and verify DATABASE_URL.',
      recommendedNextStep:
        'Verify DATABASE_URL and database availability; run migrations after connectivity is restored.',
      remediationType: 'dependency_recovery',
      fixInProduct: false,
      requiresDeployOrInfra: true,
      retrySafe: true,
      evidence: [report.dependencies.database.message ?? 'check failed'],
      lastCheckedAt: report.dependencies.database.checkedAt,
      blocksReadiness: true,
      appUsable: false,
      canOperatorContinueSafely: false,
      whoShouldAct: 'deployment_engineer',
      acknowledged: false,
      suppressedFromBanner: false,
    });
  }
  if (!report.dependencies.redis.ok) {
    out.push({
      id: 'dep:redis',
      code: 'DEP_REDIS',
      target: { kind: 'dependency', id: 'redis' },
      severity: 'critical',
      stateCategory: 'dependency',
      summary: report.dependencies.redis.message ?? 'Redis is not reachable.',
      impactUser: 'Background jobs will not run; some actions may queue indefinitely.',
      impactOperator: 'Start Redis and confirm REDIS_URL for this deployment.',
      recommendedNextStep: 'Start Redis and set REDIS_URL; docker compose up includes Redis.',
      remediationType: 'dependency_recovery',
      fixInProduct: false,
      requiresDeployOrInfra: true,
      retrySafe: true,
      evidence: [report.dependencies.redis.message ?? 'check failed'],
      lastCheckedAt: report.dependencies.redis.checkedAt,
      blocksReadiness: true,
      appUsable: appUsableFromReport(report),
      canOperatorContinueSafely: appUsableFromReport(report),
      whoShouldAct: 'deployment_engineer',
      acknowledged: false,
      suppressedFromBanner: false,
    });
  }
  if (!report.dependencies.sessionStore.ok) {
    out.push({
      id: 'dep:session',
      code: 'DEP_SESSION',
      target: { kind: 'dependency', id: 'sessionStore' },
      severity: 'critical',
      stateCategory: 'environment',
      summary: report.dependencies.sessionStore.message ?? 'Session stack is not healthy.',
      impactUser: 'Authentication and organization access may break.',
      impactOperator: 'Fix NEXTAUTH_* and database per environment validation.',
      recommendedNextStep: 'Correct invalid environment variables and restart the app.',
      remediationType: 'deployment_env',
      fixInProduct: false,
      requiresDeployOrInfra: true,
      retrySafe: true,
      evidence: [report.dependencies.sessionStore.message ?? 'session check failed'],
      lastCheckedAt: report.dependencies.sessionStore.checkedAt,
      blocksReadiness: true,
      appUsable: false,
      canOperatorContinueSafely: false,
      whoShouldAct: 'deployment_engineer',
      acknowledged: false,
      suppressedFromBanner: false,
    });
  }
  return out;
}

/** Deterministic short hash for stable IDs from free-form strings (no crypto dependency). */
function hashStable(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

export function deriveSetupChecklist(report: PlatformHealthReport): PlatformSetupStep[] {
  const steps: PlatformSetupStep[] = [];
  steps.push({
    id: 'db-connectivity',
    title: 'Database reachable',
    detail: 'PostgreSQL accepts connections using DATABASE_URL.',
    done: report.dependencies.database.ok,
    blocking: true,
    fixRemediationType: 'dependency_recovery',
    fixInProduct: false,
  });
  steps.push({
    id: 'env-valid',
    title: 'Deployment environment valid',
    detail: 'Required env vars pass validation (see System page).',
    done: report.services.find((s) => s.id === 'app-api')?.healthState === 'ready',
    blocking: true,
    fixRemediationType: 'deployment_env',
    fixInProduct: false,
  });
  steps.push({
    id: 'platform-bootstrapped',
    title: 'Platform bootstrapped in database',
    detail: 'PlatformState row exists (npm run bootstrap / seed).',
    done: report.bootstrap.installed,
    blocking: true,
    fixRemediationType: 'bootstrap_completion',
    fixInProduct: false,
  });
  steps.push({
    id: 'redis',
    title: 'Redis for job queues',
    detail: 'Redis reachable at REDIS_URL.',
    done: report.dependencies.redis.ok,
    blocking: true,
    fixRemediationType: 'dependency_recovery',
    fixInProduct: false,
  });
  const worker = report.services.find((s) => s.id === 'worker-runtime');
  steps.push({
    id: 'workers',
    title: 'Background workers running',
    detail: 'Worker process reports a fresh heartbeat.',
    done: worker?.healthState === 'running',
    blocking: true,
    fixRemediationType: 'dependency_recovery',
    fixInProduct: false,
  });
  steps.push({
    id: 'optional-integrations',
    title: 'Optional integrations (Stripe, GitHub, S3, AI)',
    detail: 'Configure only what you need; missing optional keys do not block core readiness.',
    done: report.bootstrap.readiness === 'ready' || report.bootstrap.readiness === 'degraded',
    blocking: false,
    fixRemediationType: 'deployment_env',
    fixInProduct: false,
  });
  return steps;
}

export function derivePlatformDiagnostics(
  report: PlatformHealthReport,
  flags: ParsedOperatorPlatformFlags = DEFAULT_FLAGS
): {
  issues: PlatformDiagnosticIssue[];
  setupChecklist: PlatformSetupStep[];
  summary: ControlPlaneSummary;
} {
  const issues: PlatformDiagnosticIssue[] = [];

  issues.push(...dependencyIssues(report));
  issues.push(...bootstrapIssues(report));

  for (const svc of report.services) {
    const i = issueFromService(report, svc);
    if (i) issues.push(i);
  }

  const ackSet = new Set(flags.acknowledgements.acknowledgedIssueIds);
  const suppressed = new Set(flags.prefs.suppressedOptionalDiagnosticIds);

  for (const issue of issues) {
    issue.acknowledged = ackSet.has(issue.id);
    const isOptionalSvc =
      issue.target.kind === 'service' &&
      report.services.find((s) => s.id === issue.target.id)?.criticality === 'optional';
    issue.suppressedFromBanner = isOptionalSvc && suppressed.has(issue.id);
  }

  const summary = splitSummary(issues, report);

  return {
    issues,
    setupChecklist: deriveSetupChecklist(report),
    summary,
  };
}

function splitSummary(issues: PlatformDiagnosticIssue[], report: PlatformHealthReport): ControlPlaneSummary {
  const optionalIds = new Set(
    report.services.filter((s) => s.criticality === 'optional').map((s) => s.id)
  );

  const criticalBlockers = issues.filter(
    (i) => i.blocksReadiness && i.severity === 'critical' && !i.acknowledged && !i.suppressedFromBanner
  );
  const warnings = issues.filter(
    (i) =>
      !i.blocksReadiness &&
      ['high', 'medium', 'low'].includes(i.severity) &&
      !i.acknowledged &&
      !i.suppressedFromBanner
  );
  const recoverableIssues = issues.filter(
    (i) =>
      i.blocksReadiness &&
      i.severity === 'high' &&
      !i.acknowledged &&
      !i.suppressedFromBanner
  );
  const optionalUnavailable = issues.filter(
    (i) =>
      i.target.kind === 'service' &&
      optionalIds.has(i.target.id) &&
      !i.acknowledged &&
      !i.suppressedFromBanner
  );
  const acknowledgedIssues = issues.filter((i) => i.acknowledged);
  return {
    criticalBlockers,
    warnings,
    recoverableIssues,
    optionalUnavailable,
    acknowledgedIssues,
  };
}

export function listOperatorActions(): OperatorActionDescriptor[] {
  return [
    {
      id: 'recheck_readiness',
      label: 'Recheck readiness',
      description:
        'Re-runs live connectivity, queue, and worker checks synchronously. Does not change configuration.',
      method: 'POST',
      pathSuffix: 'recheck',
      available: true,
    },
    {
      id: 'ack_issue',
      label: 'Acknowledge issue',
      description:
        'Records operator acknowledgement for a diagnostic id (does not repair underlying health). Use for accepted risk.',
      method: 'POST',
      pathSuffix: 'acknowledge',
      available: true,
    },
    {
      id: 'suppress_optional',
      label: 'Hide optional warning',
      description:
        'Stops showing a specific optional-service diagnostic in operator banners. Deployment-wide; does not disable the service.',
      method: 'PATCH',
      pathSuffix: 'operator-preferences',
      available: true,
    },
  ];
}
