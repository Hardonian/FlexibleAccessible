import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getOrganizationMembers, removeOrganizationMember } from './actions';

// Mock the dependencies at the top level of your test file
vi.mock('@/lib/session');
vi.mock('@/lib/platform-truth-cache');
vi.mock('@/lib/route-data-boundary');
vi.mock('@/lib/findings/org-scoped-queries');

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Import the mocked versions to gain type safety and access to mock functions
import { requireSession } from '@/lib/session';
import { getRoutePlatformTruth } from '@/lib/platform-truth-cache';
import { resolveDashboardOrgMembership } from '@/lib/route-data-boundary';
import { getScopedMembers } from '@/lib/findings/org-scoped-queries';
import { revalidatePath, revalidateTag } from 'next/cache';

describe('Server Action: getOrganizationMembers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Set up default "happy path" mocks that can be overridden in specific tests
    vi.mocked(requireSession).mockResolvedValue({ id: 'user-123', name: 'Test User' } as any);
    vi.mocked(getRoutePlatformTruth).mockResolvedValue({ allowOrgScopedDbReads: true } as any);
  });

  it('should return organization members on success', async () => {
    // Arrange: Simulate a successful org resolution and data fetch
    vi.mocked(resolveDashboardOrgMembership).mockResolvedValue({
      kind: 'ok',
      organizationId: 'org-abc',
      role: 'ADMIN',
    });
    const mockMembers = [{ user: { id: 'user-123', name: 'Test User', email: 'test@example.com' } }];
    vi.mocked(getScopedMembers).mockResolvedValue({
      ok: true,
      data: mockMembers as any,
    });

    // Act
    const result = await getOrganizationMembers();

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(mockMembers);
    }
    expect(resolveDashboardOrgMembership).toHaveBeenCalledWith('user-123', expect.any(Object));
    expect(getScopedMembers).toHaveBeenCalledWith({ kind: 'ok', organizationId: 'org-abc', role: 'ADMIN' });
  });

  it('should return an error if organization context cannot be resolved', async () => {
    // Arrange: Simulate a failure to find the user's organization
    vi.mocked(resolveDashboardOrgMembership).mockResolvedValue({
      kind: 'none',
    });

    // Act
    const result = await getOrganizationMembers();

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Organization not found');
    }
    // Crucially, the scoped query should NOT be called if the boundary fails
    expect(getScopedMembers).not.toHaveBeenCalled();
  });

  it('should return an error if the platform is degraded', async () => {
    // Arrange: Simulate a platform-wide issue blocking DB reads
    vi.mocked(resolveDashboardOrgMembership).mockResolvedValue({
      kind: 'platform_blocked',
      truth: {} as any,
    });

    // Act
    const result = await getOrganizationMembers();

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('platform is unavailable');
    }
    expect(getScopedMembers).not.toHaveBeenCalled();
  });

  it('should return an error if the scoped query itself fails', async () => {
    // Arrange: Simulate a successful org resolution but a failed DB query
    vi.mocked(resolveDashboardOrgMembership).mockResolvedValue({ kind: 'ok', organizationId: 'org-abc', role: 'ADMIN' });
    vi.mocked(getScopedMembers).mockResolvedValue({ ok: false, message: 'Internal database error' });

    // Act
    const result = await getOrganizationMembers();

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Internal database error');
    }
  });
});

describe('Server Action: removeOrganizationMember', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireSession).mockResolvedValue({ id: 'user-123', name: 'Test User' } as any);
    vi.mocked(getRoutePlatformTruth).mockResolvedValue({ allowOrgScopedDbReads: true } as any);
  });

  it('should revalidate the path and tag upon successful mutation', async () => {
    // Arrange
    vi.mocked(resolveDashboardOrgMembership).mockResolvedValue({
      kind: 'ok',
      organizationId: 'org-abc',
      role: 'ADMIN',
    });

    // Act
    const result = await removeOrganizationMember('member-456');

    // Assert
    expect(result.success).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith('/settings/members');
    expect(revalidateTag).toHaveBeenCalledWith('members-list');
  });
});