import { collectPlatformHealth, buildRoutePlatformTruth } from '@aros/core-services';
import { parseEnvDiagnostics } from '@aros/config';
import { prisma } from './db';
import type { PlatformHealthReport, RoutePlatformTruth } from '@aros/core-services';

export interface PlatformHealthApiPayload {
  report: PlatformHealthReport;
  envDiagnostics: {
    valid: boolean;
    invalidKeys: string[];
  };
  /** Same projection as dashboard shell — safe for JSON (no secrets). */
  routePlatformTruth: RoutePlatformTruth;
}

export async function getPlatformHealthPayload(): Promise<PlatformHealthApiPayload> {
  const diag = parseEnvDiagnostics(process.env);
  const invalidKeys = Object.keys(diag.fieldErrors).filter(
    (k) => (diag.fieldErrors[k]?.length ?? 0) > 0
  );
  const report = await collectPlatformHealth(prisma);
  return {
    report,
    envDiagnostics: { valid: diag.valid, invalidKeys },
    routePlatformTruth: buildRoutePlatformTruth(report),
  };
}
