import { describe, expect, it } from 'vitest';
import { summarizeFindingFamilies } from './family-summary';

describe('summarizeFindingFamilies', () => {
  it('builds recurring family totals, activity, and trend counters', () => {
    const result = summarizeFindingFamilies([
      {
        ruleId: 'color-contrast',
        firstSeenAt: new Date('2026-03-01T00:00:00.000Z'),
        lastSeenAt: new Date('2026-03-10T00:00:00.000Z'),
        reopenedCount: 1,
        status: 'OPEN',
        distinctScanRunsObserved: 3,
      },
      {
        ruleId: 'color-contrast',
        firstSeenAt: new Date('2026-03-09T00:00:00.000Z'),
        lastSeenAt: new Date('2026-03-09T00:00:00.000Z'),
        reopenedCount: 0,
        status: 'RESOLVED',
        distinctScanRunsObserved: 1,
      },
    ]);

    expect(result['color-contrast']).toMatchObject({
      totalFindings: 2,
      activeFindings: 1,
      regressedFindings: 1,
      newlyDetectedFindings: 1,
      persistentFindings: 1,
      recurringAcrossScanRunsFindings: 1,
    });
    expect(result['color-contrast'].firstSeenAt?.toISOString()).toBe(
      '2026-03-01T00:00:00.000Z',
    );
    expect(result['color-contrast'].lastSeenAt?.toISOString()).toBe(
      '2026-03-10T00:00:00.000Z',
    );
  });
});
