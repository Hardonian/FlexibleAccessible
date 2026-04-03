import { describe, expect, it } from 'vitest';
import { PLANS } from '@aros/config';
import { getPublicPlanCards } from './public-packaging';

describe('getPublicPlanCards', () => {
  it('stays aligned with canonical plan limits and avoids unlimited claim drift', () => {
    const cards = getPublicPlanCards();
    const enterprise = cards.find((c) => c.tier === 'ENTERPRISE');
    expect(enterprise).toBeDefined();

    expect(enterprise?.bullets).toContain(
      `${PLANS.ENTERPRISE.maxScansPerMonth.toLocaleString()} scans per month`,
    );
    expect(enterprise?.bullets.join(' ')).not.toMatch(/unlimited scans/i);
  });

  it('reflects AI access truthfully by plan tier', () => {
    const cards = getPublicPlanCards();
    const starter = cards.find((c) => c.tier === 'STARTER');
    const professional = cards.find((c) => c.tier === 'PROFESSIONAL');

    expect(starter?.bullets).toContain('AI remediation not included');
    expect(professional?.bullets).toContain(
      `AI remediation included (${PLANS.PROFESSIONAL.aiTokenLimit.toLocaleString()} tokens/month)`,
    );
  });
});
