import { describe, expect, it } from 'vitest';
import {
  applyScopedOperatorFlagsUpdate,
  backfillLegacyOperatorFlagsForOrgRecord,
  parseOperatorFlagsForOrganization,
  resolveOperatorFlagsForOrganization,
} from './operator-org-flags';
import type { ParsedOperatorPlatformFlags } from '@aros/core-services';

describe('resolveOperatorFlagsForOrganization', () => {
  it('reads organization-scoped operator flags when available', () => {
    const resolved = resolveOperatorFlagsForOrganization(
      {
        operatorPrefsByOrg: {
          orgA: { suppressedOptionalDiagnosticIds: ['svc:stripe-billing'] },
        },
        operatorAcknowledgementsByOrg: {
          orgA: { acknowledgedIssueIds: ['svc:slack-webhooks'], updatedAt: '2026-03-20T00:00:00.000Z' },
        },
      },
      'orgA'
    );

    expect(resolved.source).toBe('scoped');
    expect(resolved.flags.prefs.suppressedOptionalDiagnosticIds).toEqual(['svc:stripe-billing']);
    expect(resolved.flags.acknowledgements.acknowledgedIssueIds).toEqual(['svc:slack-webhooks']);
  });

  it('falls back to legacy deployment-wide keys when scoped keys are missing', () => {
    const resolved = resolveOperatorFlagsForOrganization(
      {
        operatorPrefs: { suppressedOptionalDiagnosticIds: ['svc:slack-webhooks'] },
      },
      'orgA'
    );

    expect(resolved.source).toBe('legacy_fallback');
    expect(resolved.flags.prefs.suppressedOptionalDiagnosticIds).toEqual(['svc:slack-webhooks']);
  });

  it('prefers explicit scoped empty state over legacy fallback once org keys exist', () => {
    const resolved = resolveOperatorFlagsForOrganization(
      {
        operatorPrefs: { suppressedOptionalDiagnosticIds: ['svc:slack-webhooks'] },
        operatorPrefsByOrg: {
          orgA: { suppressedOptionalDiagnosticIds: [] },
        },
      },
      'orgA'
    );

    expect(resolved.source).toBe('scoped');
    expect(resolved.flags.prefs.suppressedOptionalDiagnosticIds).toEqual([]);
  });
});

describe('parseOperatorFlagsForOrganization', () => {
  it('returns parsed flag payload for existing consumers', () => {
    const parsed = parseOperatorFlagsForOrganization(
      {
        operatorPrefs: { suppressedOptionalDiagnosticIds: ['svc:slack-webhooks'] },
      },
      'orgA'
    );

    expect(parsed.prefs.suppressedOptionalDiagnosticIds).toEqual(['svc:slack-webhooks']);
  });
});

describe('applyScopedOperatorFlagsUpdate', () => {
  it('persists updated flags under organization namespaced keys without dropping unrelated flags', () => {
    const next: ParsedOperatorPlatformFlags = {
      prefs: { suppressedOptionalDiagnosticIds: ['svc:jira'] },
      acknowledgements: { acknowledgedIssueIds: ['svc:s3-evidence'], updatedAt: '2026-03-21T00:00:00.000Z' },
    };

    const updated = applyScopedOperatorFlagsUpdate(
      {
        releaseChannel: 'stable',
        operatorPrefsByOrg: { orgB: { suppressedOptionalDiagnosticIds: ['svc:stripe-billing'] } },
      },
      'orgA',
      next
    );

    expect(updated.releaseChannel).toBe('stable');
    expect((updated.operatorPrefsByOrg as Record<string, unknown>).orgA).toEqual({
      suppressedOptionalDiagnosticIds: ['svc:jira'],
    });
    expect((updated.operatorPrefsByOrg as Record<string, unknown>).orgB).toEqual({
      suppressedOptionalDiagnosticIds: ['svc:stripe-billing'],
    });
    expect((updated.operatorAcknowledgementsByOrg as Record<string, unknown>).orgA).toEqual({
      acknowledgedIssueIds: ['svc:s3-evidence'],
      updatedAt: '2026-03-21T00:00:00.000Z',
    });
  });
});

describe('backfillLegacyOperatorFlagsForOrgRecord', () => {
  it('backfills legacy flags into org namespace when fallback is active', () => {
    const { next, result } = backfillLegacyOperatorFlagsForOrgRecord(
      {
        operatorPrefs: { suppressedOptionalDiagnosticIds: ['svc:slack-webhooks'] },
      },
      'orgA'
    );

    expect(result).toEqual({
      status: 'migrated',
      source: 'legacy_fallback',
      migrated: true,
    });
    expect((next.operatorPrefsByOrg as Record<string, unknown>).orgA).toEqual({
      suppressedOptionalDiagnosticIds: ['svc:slack-webhooks'],
    });
  });

  it('is idempotent when scoped state already exists for org', () => {
    const original = {
      operatorPrefsByOrg: {
        orgA: { suppressedOptionalDiagnosticIds: ['svc:jira'] },
      },
      operatorPrefs: { suppressedOptionalDiagnosticIds: ['svc:slack-webhooks'] },
    };

    const { next, result } = backfillLegacyOperatorFlagsForOrgRecord(original, 'orgA');

    expect(result).toEqual({
      status: 'skipped_scoped_present',
      source: 'scoped',
      migrated: false,
    });
    expect(next).toBe(original);
  });

  it('skips when no legacy fallback data exists', () => {
    const original = { releaseChannel: 'stable' };

    const { next, result } = backfillLegacyOperatorFlagsForOrgRecord(original, 'orgA');

    expect(result).toEqual({
      status: 'skipped_no_legacy',
      source: 'none',
      migrated: false,
    });
    expect(next).toBe(original);
  });
});
