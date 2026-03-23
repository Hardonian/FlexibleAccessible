import { describe, expect, it, vi } from 'vitest';
import { transitionFindingRemediationStatus } from './remediation-server';

function mockPrisma() {
  const tx = vi.fn((ops: Promise<unknown>[]) => Promise.all(ops));
  return {
    canonicalFinding: {
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    findingStatusEvent: {
      create: vi.fn().mockResolvedValue({}),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    $transaction: tx,
  } as unknown as import('@aros/db').PrismaClient;
}

describe('transitionFindingRemediationStatus', () => {
  it('returns forbidden without findings:manage', async () => {
    const prisma = mockPrisma();
    const res = await transitionFindingRemediationStatus({
      prisma,
      findingId: 'f1',
      organizationId: 'o1',
      userId: 'u1',
      userRole: 'REVIEWER',
      nextStatus: 'ACKNOWLEDGED',
    });
    expect(res).toEqual({ ok: false, code: 'forbidden' });
  });

  it('returns not_found when finding not in org scope', async () => {
    const prisma = mockPrisma();
    (prisma.canonicalFinding.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await transitionFindingRemediationStatus({
      prisma,
      findingId: 'f1',
      organizationId: 'o1',
      userId: 'u1',
      userRole: 'OWNER',
      nextStatus: 'ACKNOWLEDGED',
    });
    expect(res).toEqual({ ok: false, code: 'not_found' });
  });

  it('returns invalid_transition when disallowed', async () => {
    const prisma = mockPrisma();
    (prisma.canonicalFinding.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'f1',
      status: 'FALSE_POSITIVE',
      siteId: 's1',
    });
    const res = await transitionFindingRemediationStatus({
      prisma,
      findingId: 'f1',
      organizationId: 'o1',
      userId: 'u1',
      userRole: 'OWNER',
      nextStatus: 'RESOLVED',
    });
    expect(res).toEqual({ ok: false, code: 'invalid_transition' });
  });

  it('runs transaction on valid transition', async () => {
    const prisma = mockPrisma();
    (prisma.canonicalFinding.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'f1',
      status: 'OPEN',
      siteId: 's1',
    });
    const res = await transitionFindingRemediationStatus({
      prisma,
      findingId: 'f1',
      organizationId: 'o1',
      userId: 'u1',
      userRole: 'OWNER',
      nextStatus: 'ACKNOWLEDGED',
      note: ' triage ',
    });
    expect(res).toEqual({ ok: true });
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
