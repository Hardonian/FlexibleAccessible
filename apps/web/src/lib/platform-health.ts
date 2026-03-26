import {
  collectPlatformHealth,
  buildRoutePlatformTruth,
  derivePlatformDiagnostics,
  listOperatorActions,
  type ControlPlaneSummary,
  type OperatorActionDescriptor,
  type PlatformDiagnosticIssue,
  type PlatformSetupStep,
} from '@aros/core-services';
import { parseEnvDiagnostics } from '@aros/config';
import { prisma } from './db';
import { parseOperatorFlagsForOrganization } from './operator-org-flags';
import type { PlatformHealthReport, RoutePlatformTruth } from '@aros/core-services';
import { getRecentPlatformAuditEntries, type RecentPlatformAuditEntry } from './operator-platform-audit';

export interface PlatformHealthApiPayload {
  report: PlatformHealthReport;
  envDiagnostics: {
    valid: boolean;
    invalidKeys: string[];
  };
  /** Same projection as dashboard shell — safe for JSON (no secrets). */
  routePlatformTruth: RoutePlatformTruth;
  diagnostics: {
    issues: PlatformDiagnosticIssue[];
    setupChecklist: PlatformSetupStep[];
    summary: ControlPlaneSummary;
  };
  operatorActions: OperatorActionDescriptor[];
  recentPlatformActions: RecentPlatformAuditEntry[];
  operatorFlags: ReturnType<typeof parseOperatorFlagsForOrganization>;
}

export async function getPlatformHealthPayload(organizationId?: string): Promise<PlatformHealthApiPayload> {
  const diag = parseEnvDiagnostics(process.env);
  const invalidKeys = Object.keys(diag.fieldErrors).filter(
    (k) => (diag.fieldErrors[k]?.length ?? 0) > 0
  );
  const report = await collectPlatformHealth(prisma);
  const parsedFlags = parseOperatorFlagsForOrganization(report.operatorPlatformFlags, organizationId);
  const { issues, setupChecklist, summary } = derivePlatformDiagnostics(report, parsedFlags);
  const recentPlatformActions =
    organizationId != null
      ? await getRecentPlatformAuditEntries(organizationId).catch(() => [])
      : [];
  return {
    report,
    envDiagnostics: { valid: diag.valid, invalidKeys },
    routePlatformTruth: buildRoutePlatformTruth(report),
    diagnostics: { issues, setupChecklist, summary },
    operatorActions: listOperatorActions(),
    recentPlatformActions,
    operatorFlags: parsedFlags,
  };
}
