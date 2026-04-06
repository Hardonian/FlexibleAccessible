import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  inviteMemberAction,
  changeMemberRoleAction,
  removeMemberAction,
} from "./actions";

vi.mock("@/lib/db", () => ({
  prisma: {
    membership: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/auth-guard", () => ({
  requireOrgAccess: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { requireOrgAccess } from "@/lib/auth-guard";

describe("inviteMemberAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
  });

  it("invites existing user successfully", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", name: "Admin", emailVerified: true },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      maxSeats: 5,
    } as any);
    vi.mocked(prisma.membership.count).mockResolvedValue(2);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_new",
      email: "newuser@example.com",
    } as any);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.membership.create).mockResolvedValue({} as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("email", "newuser@example.com");
    formData.set("role", "DEVELOPER");

    const result = await inviteMemberAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(true);
    expect(prisma.membership.create).toHaveBeenCalledWith({
      data: {
        userId: "user_new",
        organizationId: "org_123",
        role: "DEVELOPER",
      },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org_123",
        userId: "user_admin",
        action: "member:invite",
        entityType: "membership",
        entityId: "user_new",
        metadata: { invitedEmail: "newuser@example.com", role: "DEVELOPER" },
      }),
    });
  });

  it("rejects invalid email format", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", name: "Admin", emailVerified: true },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("email", "invalid-email");
    formData.set("role", "DEVELOPER");

    const result = await inviteMemberAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Please enter a valid email address");
  });

  it("rejects empty email", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", name: "Admin", emailVerified: true },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("email", "");
    formData.set("role", "DEVELOPER");

    const result = await inviteMemberAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Email is required");
  });

  it("rejects invalid role", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", name: "Admin", emailVerified: true },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("email", "new@example.com");
    formData.set("role", "OWNER");

    const result = await inviteMemberAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid role selected");
  });

  it("enforces seat limit", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", name: "Admin", emailVerified: true },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      maxSeats: 3,
    } as any);
    vi.mocked(prisma.membership.count).mockResolvedValue(3);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("email", "new@example.com");
    formData.set("role", "DEVELOPER");

    const result = await inviteMemberAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "Seat limit reached. Upgrade your plan to add more members.",
    );
  });

  it("counts pending invites toward seat limit", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", name: "Admin" },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      maxSeats: 3,
    } as any);
    vi.mocked(prisma.membership.count).mockResolvedValue(2);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(1);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("email", "new@example.com");
    formData.set("role", "DEVELOPER");

    const result = await inviteMemberAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "Seat limit reached. Upgrade your plan to add more members.",
    );
  });

  it("rejects inviting existing member", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", name: "Admin", emailVerified: true },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      maxSeats: 5,
    } as any);
    vi.mocked(prisma.membership.count).mockResolvedValue(2);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_existing",
      email: "existing@example.com",
    } as any);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({
      id: "membership_123",
      userId: "user_existing",
      organizationId: "org_123",
    } as any);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("email", "existing@example.com");
    formData.set("role", "DEVELOPER");

    const result = await inviteMemberAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "This user is already a member of this organization",
    );
  });

  it("records pending invitation for non-existent user", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", name: "Admin", emailVerified: true },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      maxSeats: 5,
    } as any);
    vi.mocked(prisma.membership.count).mockResolvedValue(2);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("email", "newuser@example.com");
    formData.set("role", "DEVELOPER");

    const result = await inviteMemberAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(true);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "member:invite_pending",
        metadata: { invitedEmail: "newuser@example.com", role: "DEVELOPER" },
      }),
    });
  });

  it("rejects for DEVELOPER role", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_dev", email: "dev@example.com", name: "Dev", emailVerified: true },
      organizationId: "org_123",
      role: "DEVELOPER",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("email", "new@example.com");
    formData.set("role", "DEVELOPER");

    const result = await inviteMemberAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Only admins and owners can invite members");
  });

  it("OWNER can invite ADMIN", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_owner", email: "owner@example.com", name: "Owner", emailVerified: true },
      organizationId: "org_123",
      role: "OWNER",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
      maxSeats: 5,
    } as any);
    vi.mocked(prisma.membership.count).mockResolvedValue(2);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_new",
      email: "admin@example.com",
    } as any);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.membership.create).mockResolvedValue({} as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("email", "admin@example.com");
    formData.set("role", "ADMIN");

    const result = await inviteMemberAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(true);
  });

  it("ADMIN cannot invite OWNER", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", name: "Admin", emailVerified: true },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("email", "owner@example.com");
    formData.set("role", "OWNER");

    const result = await inviteMemberAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid role selected");
  });
});

describe("changeMemberRoleAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("changes role successfully", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", name: "Admin", emailVerified: true },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: "membership_456",
      userId: "user_target",
      role: "DEVELOPER",
      user: { id: "user_target", email: "target@example.com" },
    } as any);
    vi.mocked(prisma.membership.update).mockResolvedValue({} as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("membershipId", "membership_456");
    formData.set("newRole", "AUDITOR");

    const result = await changeMemberRoleAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(true);
    expect(prisma.membership.update).toHaveBeenCalledWith({
      where: { id: "membership_456" },
      data: { role: "AUDITOR" },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "member:role_change",
        metadata: expect.objectContaining({
          oldRole: "DEVELOPER",
          newRole: "AUDITOR",
        }),
      }),
    });
  });

  it("prevents self-role change", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", name: "Admin", emailVerified: true },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: "membership_admin",
      userId: "user_admin",
      role: "ADMIN",
      user: { id: "user_admin", email: "admin@example.com" },
    } as any);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("membershipId", "membership_admin");
    formData.set("newRole", "DEVELOPER");

    const result = await changeMemberRoleAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "You cannot change your own role. Ask another admin to do this.",
    );
  });

  it("prevents ADMIN from changing OWNER role", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", name: "Admin", emailVerified: true },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: "membership_owner",
      userId: "user_owner",
      role: "OWNER",
      user: { id: "user_owner", email: "owner@example.com" },
    } as any);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("membershipId", "membership_owner");
    formData.set("newRole", "DEVELOPER");

    const result = await changeMemberRoleAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    // ADMIN cannot manage OWNER, caught by canManageRole first
    expect(result.error).toBe(
      "You do not have permission to modify this member's role",
    );
  });

  it("prevents ADMIN from assigning OWNER role", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", name: "Admin", emailVerified: true },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: "membership_456",
      userId: "user_target",
      role: "DEVELOPER",
      user: { id: "user_target", email: "target@example.com" },
    } as any);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("membershipId", "membership_456");
    formData.set("newRole", "OWNER");

    const result = await changeMemberRoleAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    // ADMIN cannot assign OWNER via canChangeToRole check
    expect(result.error).toBe("You do not have permission to assign this role");
  });

  it("prevents ADMIN from modifying another ADMIN", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_admin1", email: "admin1@example.com", name: "Admin1", emailVerified: true },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: "membership_admin2",
      userId: "user_admin2",
      role: "ADMIN",
      user: { id: "user_admin2", email: "admin2@example.com" },
    } as any);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("membershipId", "membership_admin2");
    formData.set("newRole", "DEVELOPER");

    const result = await changeMemberRoleAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "You do not have permission to modify this member's role",
    );
  });

  it("allows OWNER to modify ADMIN", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_owner", email: "owner@example.com", name: "Owner", emailVerified: true },
      organizationId: "org_123",
      role: "OWNER",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: "membership_admin",
      userId: "user_admin",
      role: "ADMIN",
      user: { id: "user_admin", email: "admin@example.com" },
    } as any);
    vi.mocked(prisma.membership.update).mockResolvedValue({} as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("membershipId", "membership_admin");
    formData.set("newRole", "DEVELOPER");

    const result = await changeMemberRoleAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(true);
  });
});

describe("removeMemberAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("removes member successfully", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", name: "Admin", emailVerified: true },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: "membership_456",
      userId: "user_target",
      role: "DEVELOPER",
      user: { id: "user_target", email: "target@example.com" },
    } as any);
    vi.mocked(prisma.membership.delete).mockResolvedValue({} as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("membershipId", "membership_456");

    const result = await removeMemberAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(true);
    expect(prisma.membership.delete).toHaveBeenCalledWith({
      where: { id: "membership_456" },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "member:remove",
        metadata: expect.objectContaining({
          removedUserId: "user_target",
          removedUserEmail: "target@example.com",
          role: "DEVELOPER",
        }),
      }),
    });
  });

  it("prevents self-removal", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", name: "Admin", emailVerified: true },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: "membership_admin",
      userId: "user_admin",
      role: "ADMIN",
      user: { id: "user_admin", email: "admin@example.com" },
    } as any);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("membershipId", "membership_admin");

    const result = await removeMemberAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "You cannot remove yourself from the organization",
    );
  });

  it("prevents removing last OWNER", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_owner", email: "owner@example.com", name: "Owner", emailVerified: true },
      organizationId: "org_123",
      role: "OWNER",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: "membership_other_owner",
      userId: "user_other",
      role: "OWNER",
      user: { id: "user_other", email: "other@example.com" },
    } as any);
    vi.mocked(prisma.membership.count).mockResolvedValue(1);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("membershipId", "membership_other_owner");

    const result = await removeMemberAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "Cannot remove the last owner. Transfer ownership first.",
    );
  });

  it("allows removing non-last OWNER", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_owner1", email: "owner1@example.com", name: "Owner1", emailVerified: true },
      organizationId: "org_123",
      role: "OWNER",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: "membership_owner2",
      userId: "user_owner2",
      role: "OWNER",
      user: { id: "user_owner2", email: "owner2@example.com" },
    } as any);
    vi.mocked(prisma.membership.count).mockResolvedValue(2);
    vi.mocked(prisma.membership.delete).mockResolvedValue({} as any);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("membershipId", "membership_owner2");

    const result = await removeMemberAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(true);
  });

  it("rejects for DEVELOPER role", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_dev", email: "dev@example.com", name: "Dev", emailVerified: true },
      organizationId: "org_123",
      role: "DEVELOPER",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("membershipId", "membership_456");

    const result = await removeMemberAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Only admins and owners can remove members");
  });

  it("prevents ADMIN from removing another ADMIN", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_admin1", email: "admin1@example.com", name: "Admin1", emailVerified: true },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.membership.findFirst).mockResolvedValue({
      id: "membership_admin2",
      userId: "user_admin2",
      role: "ADMIN",
      user: { id: "user_admin2", email: "admin2@example.com" },
    } as any);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("membershipId", "membership_admin2");

    const result = await removeMemberAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "You do not have permission to remove this member",
    );
  });

  it("returns error when member not found", async () => {
    vi.mocked(requireOrgAccess).mockResolvedValue({
      user: { id: "user_admin", email: "admin@example.com", name: "Admin", emailVerified: true },
      organizationId: "org_123",
      role: "ADMIN",
      subscription: null,
      entitlement: { hasPaidAccess: false, reason: "free_plan" },
    });

    vi.mocked(prisma.membership.findFirst).mockResolvedValue(null);

    const formData = new FormData();
    formData.set("organizationId", "org_123");
    formData.set("membershipId", "membership_nonexistent");

    const result = await removeMemberAction(
      { success: false, error: null },
      formData,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("Member not found");
  });
});
