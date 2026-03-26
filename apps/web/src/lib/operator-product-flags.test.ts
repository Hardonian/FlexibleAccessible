import { describe, expect, it } from 'vitest';
import {
  applyScopedOperatorFlagsUpdate,
  parseOperatorFlagsForOrganization,
} from './operator-org-flags';
import type { ParsedOperatorPlatformFlags } from '@aros/core-services';

describe('parseOperatorFlagsForOrganization', () => {
  it('reads organization-scoped operator flags when available', () => {
    const parsed = parseOperatorFlagsForOrganization(
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

    expect(parsed.prefs.suppressedOptionalDiagnosticIds).toEqual(['svc:stripe-billing']);
    expect(parsed.acknowledgements.acknowledgedIssueIds).toEqual(['svc:slack-webhooks']);
  });

  it('falls back to legacy deployment-wide keys when scoped keys are missing', () => {
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
