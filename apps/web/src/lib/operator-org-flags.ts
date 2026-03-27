import {
  parseOperatorPlatformFlags,
  serializeOperatorPlatformFlags,
  type ParsedOperatorPlatformFlags,
} from '@aros/core-services';

const OPERATOR_PREFS_BY_ORG_KEY = 'operatorPrefsByOrg';
const OPERATOR_ACKS_BY_ORG_KEY = 'operatorAcknowledgementsByOrg';

export type OperatorFlagsSource = 'scoped' | 'legacy_fallback' | 'none';
export type LegacyDependenceStatus = 'scoped_clean' | 'legacy_fallback' | 'no_operator_state';

export interface OperatorFlagsResolution {
  flags: ParsedOperatorPlatformFlags;
  source: OperatorFlagsSource;
  hasScopedEntry: boolean;
  hasLegacyValues: boolean;
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function hasMeaningfulFlags(parsed: ParsedOperatorPlatformFlags): boolean {
  return (
    parsed.prefs.suppressedOptionalDiagnosticIds.length > 0 ||
    parsed.acknowledgements.acknowledgedIssueIds.length > 0 ||
    parsed.acknowledgements.updatedAt != null
  );
}

function readScopedFlags(raw: Record<string, unknown>, organizationId: string): {
  flags: ParsedOperatorPlatformFlags;
  hasScopedEntry: boolean;
} {
  const prefsByOrg = raw[OPERATOR_PREFS_BY_ORG_KEY];
  const acksByOrg = raw[OPERATOR_ACKS_BY_ORG_KEY];

  const prefsByOrgRecord =
    prefsByOrg && typeof prefsByOrg === 'object' && !Array.isArray(prefsByOrg)
      ? (prefsByOrg as Record<string, unknown>)
      : null;
  const acksByOrgRecord =
    acksByOrg && typeof acksByOrg === 'object' && !Array.isArray(acksByOrg)
      ? (acksByOrg as Record<string, unknown>)
      : null;

  const hasScopedEntry =
    (prefsByOrgRecord ? hasOwn(prefsByOrgRecord, organizationId) : false) ||
    (acksByOrgRecord ? hasOwn(acksByOrgRecord, organizationId) : false);

  const scoped = {
    operatorPrefs: prefsByOrgRecord?.[organizationId],
    operatorAcknowledgements: acksByOrgRecord?.[organizationId],
  };

  return {
    flags: parseOperatorPlatformFlags(scoped),
    hasScopedEntry,
  };
}

export function resolveOperatorFlagsForOrganization(
  raw: unknown,
  organizationId?: string
): OperatorFlagsResolution {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      flags: parseOperatorPlatformFlags(raw),
      source: 'none',
      hasScopedEntry: false,
      hasLegacyValues: false,
    };
  }

  const record = raw as Record<string, unknown>;
  const legacyFlags = parseOperatorPlatformFlags(record);
  const hasLegacyValues = hasMeaningfulFlags(legacyFlags);

  if (organizationId) {
    const scoped = readScopedFlags(record, organizationId);
    if (scoped.hasScopedEntry) {
      return {
        flags: scoped.flags,
        source: 'scoped',
        hasScopedEntry: true,
        hasLegacyValues,
      };
    }

    if (hasLegacyValues) {
      return {
        flags: legacyFlags,
        source: 'legacy_fallback',
        hasScopedEntry: false,
        hasLegacyValues: true,
      };
    }

    return {
      flags: scoped.flags,
      source: 'none',
      hasScopedEntry: false,
      hasLegacyValues: false,
    };
  }

  return {
    flags: legacyFlags,
    source: hasLegacyValues ? 'legacy_fallback' : 'none',
    hasScopedEntry: false,
    hasLegacyValues,
  };
}

export function parseOperatorFlagsForOrganization(
  raw: unknown,
  organizationId?: string
): ParsedOperatorPlatformFlags {
  return resolveOperatorFlagsForOrganization(raw, organizationId).flags;
}


export interface LegacyBackfillResult {
  status: 'migrated' | 'skipped_no_legacy' | 'skipped_scoped_present';
  source: OperatorFlagsSource;
  migrated: boolean;
}

export function deriveLegacyDependenceStatus(
  resolution: Pick<OperatorFlagsResolution, 'source'>
): LegacyDependenceStatus {
  if (resolution.source === 'scoped') {
    return 'scoped_clean';
  }
  if (resolution.source === 'legacy_fallback') {
    return 'legacy_fallback';
  }
  return 'no_operator_state';
}

export function backfillLegacyOperatorFlagsForOrgRecord(
  raw: Record<string, unknown>,
  organizationId: string
): { next: Record<string, unknown>; result: LegacyBackfillResult } {
  const resolution = resolveOperatorFlagsForOrganization(raw, organizationId);

  if (resolution.source === 'scoped') {
    return {
      next: raw,
      result: {
        status: 'skipped_scoped_present',
        source: resolution.source,
        migrated: false,
      },
    };
  }

  if (resolution.source !== 'legacy_fallback') {
    return {
      next: raw,
      result: {
        status: 'skipped_no_legacy',
        source: resolution.source,
        migrated: false,
      },
    };
  }

  return {
    next: applyScopedOperatorFlagsUpdate(raw, organizationId, resolution.flags),
    result: {
      status: 'migrated',
      source: resolution.source,
      migrated: true,
    },
  };
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
