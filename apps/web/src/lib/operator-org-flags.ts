import {
  parseOperatorPlatformFlags,
  serializeOperatorPlatformFlags,
  type ParsedOperatorPlatformFlags,
} from '@aros/core-services';

const OPERATOR_PREFS_BY_ORG_KEY = 'operatorPrefsByOrg';
const OPERATOR_ACKS_BY_ORG_KEY = 'operatorAcknowledgementsByOrg';

function readScopedFlags(raw: Record<string, unknown>, organizationId: string): ParsedOperatorPlatformFlags | null {
  const prefsByOrg = raw[OPERATOR_PREFS_BY_ORG_KEY];
  const acksByOrg = raw[OPERATOR_ACKS_BY_ORG_KEY];
  const scoped = {
    operatorPrefs:
      prefsByOrg && typeof prefsByOrg === 'object' && !Array.isArray(prefsByOrg)
        ? (prefsByOrg as Record<string, unknown>)[organizationId]
        : undefined,
    operatorAcknowledgements:
      acksByOrg && typeof acksByOrg === 'object' && !Array.isArray(acksByOrg)
        ? (acksByOrg as Record<string, unknown>)[organizationId]
        : undefined,
  };

  const parsed = parseOperatorPlatformFlags(scoped);
  if (
    parsed.prefs.suppressedOptionalDiagnosticIds.length === 0 &&
    parsed.acknowledgements.acknowledgedIssueIds.length === 0 &&
    parsed.acknowledgements.updatedAt == null
  ) {
    return null;
  }

  return parsed;
}

export function parseOperatorFlagsForOrganization(
  raw: unknown,
  organizationId?: string
): ParsedOperatorPlatformFlags {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return parseOperatorPlatformFlags(raw);
  }

  const record = raw as Record<string, unknown>;

  if (organizationId) {
    const scoped = readScopedFlags(record, organizationId);
    if (scoped) {
      return scoped;
    }
  }

  // Backward compatibility for historical deployment-wide keys.
  return parseOperatorPlatformFlags(record);
}

export function applyScopedOperatorFlagsUpdate(
  raw: Record<string, unknown>,
  organizationId: string,
  next: ParsedOperatorPlatformFlags
): Record<string, unknown> {
  const serialized = serializeOperatorPlatformFlags(next);

  const existingPrefsByOrg = raw[OPERATOR_PREFS_BY_ORG_KEY];
  const existingAcksByOrg = raw[OPERATOR_ACKS_BY_ORG_KEY];
  const prefsByOrg: Record<string, unknown> =
    existingPrefsByOrg && typeof existingPrefsByOrg === 'object' && !Array.isArray(existingPrefsByOrg)
      ? { ...(existingPrefsByOrg as Record<string, unknown>) }
      : {};
  const acksByOrg: Record<string, unknown> =
    existingAcksByOrg && typeof existingAcksByOrg === 'object' && !Array.isArray(existingAcksByOrg)
      ? { ...(existingAcksByOrg as Record<string, unknown>) }
      : {};

  prefsByOrg[organizationId] = serialized.operatorPrefs ?? { suppressedOptionalDiagnosticIds: [] };
  acksByOrg[organizationId] = serialized.operatorAcknowledgements ?? { acknowledgedIssueIds: [], updatedAt: null };

  return {
    ...raw,
    [OPERATOR_PREFS_BY_ORG_KEY]: prefsByOrg,
    [OPERATOR_ACKS_BY_ORG_KEY]: acksByOrg,
  };
}
