import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getScopedFindings } from './org-scoped-queries';
import { prisma } from '@/lib/db';
import type { OrgMembershipCore } from '@/lib/route-data-boundary';

vi.mock('@/lib/db', () => ({
  prisma: {
    canonicalFinding: { findMany: vi.fn() },
    site: { findMany: vi.fn() },
    membership: { findMany: vi.fn() },
  },
}));

describe('Tenant Isolation Boundary: org-scoped-queries', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should strictly enforce the organizationId deep in the relation query', async () => {
    const mockCtx: OrgMembershipCore = { organizationId: 'safe-tenant-123', role: 'MEMBER' };
    
    const result = await getScopedFindings(mockCtx);

    expect(result.ok).toBe(true);
    expect(prisma.canonicalFinding.findMany).toHaveBeenCalledTimes(1);

    const callArgs = vi.mocked(prisma.canonicalFinding.findMany).mock.calls[0][0];

    // Deeply inspect the where clause to ensure the tenant boundary is structurally locked
    expect(callArgs?.where?.occurrences?.some?.page?.site?.workspace?.organizationId)
      .toBe('safe-tenant-123');
  });

  it('should explicitly reject execution if context organizationId is missing or manipulated to undefined', async () => {
    // If organizationId is undefined, Prisma might drop the filter and return ALL findings (cross-tenant leak).
    // The runOrgScopedQuery boundary must catch this before it reaches Prisma.
    const maliciousCtx = { organizationId: undefined, role: 'MEMBER' } as unknown as OrgMembershipCore;
    
    const result = await getScopedFindings(maliciousCtx);

    // Boundary should intercept and fail safely
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain('Tenant isolation violation');
    
    // Crucially, Prisma must NEVER be invoked in this scenario to prevent data leakage
    expect(prisma.canonicalFinding.findMany).not.toHaveBeenCalled();
  });
});