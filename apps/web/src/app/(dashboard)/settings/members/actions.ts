"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOrgAccess } from "@/lib/auth-guard";
import { runOrgScopedQuery } from "@/lib/route-data-boundary";
import { hasPermission } from "@aros/config";
import type { MemberRole } from "@aros/db";

const INVITABLE_ROLES: MemberRole[] = [
  "DEVELOPER",
  "CONTENT_EDITOR",
  "AUDITOR",
  "REVIEWER",
];

const MANAGEABLE_ROLES: MemberRole[] = [
  "ADMIN",
  "DEVELOPER",
  "CONTENT_EDITOR",
  "AUDITOR",
  "REVIEWER",
];

interface InviteMemberState {
  success: boolean;
  error: string | null;
}

interface RoleChangeState {
  success: boolean;
  error: string | null;
}

interface RemoveMemberState {
  success: boolean;
  error: string | null;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function canManageRole(actorRole: MemberRole, targetRole: MemberRole): boolean {
  if (actorRole === "OWNER") return true;
  if (actorRole === "ADMIN") {
    return targetRole !== "OWNER" && targetRole !== "ADMIN";
  }
  return false;
}

function canChangeToRole(actorRole: MemberRole, newRole: MemberRole): boolean {
  if (actorRole === "OWNER") return true;
  if (actorRole === "ADMIN") {
    return INVITABLE_ROLES.includes(newRole) || newRole === "ADMIN";
  }
  return false;
}

export async function inviteMemberAction(
  _prevState: InviteMemberState,
  formData: FormData,
): Promise<InviteMemberState> {
  const organizationId = (formData.get("organizationId") as string) ?? "";
  const email = (formData.get("email") as string)?.trim().toLowerCase() ?? "";
  const role = (formData.get("role") as MemberRole) ?? "DEVELOPER";

  if (!organizationId) {
    return { success: false, error: "Organization ID is required" };
  }

  if (!email) {
    return { success: false, error: "Email is required" };
  }

  if (!isValidEmail(email)) {
    return { success: false, error: "Please enter a valid email address" };
  }

  if (!INVITABLE_ROLES.includes(role) && role !== "ADMIN") {
    return { success: false, error: "Invalid role selected" };
  }

  const ctx = await requireOrgAccess(organizationId);

  if (!hasPermission(ctx.role, "org:members:manage")) {
    return {
      success: false,
      error: "Only admins and owners can invite members",
    };
  }

  if (!canChangeToRole(ctx.role, role)) {
    return {
      success: false,
      error: "You do not have permission to invite users with this role",
    };
  }

  const subscriptionResult = await runOrgScopedQuery(ctx, async (orgId) =>
    prisma.subscription.findUnique({
      where: { organizationId: orgId },
      select: { maxSeats: true },
    }),
  );
  if (!subscriptionResult.ok) {
    return { success: false, error: "Unable to validate seat limits" };
  }

  const memberCountResult = await runOrgScopedQuery(ctx, async (orgId) =>
    prisma.membership.count({
      where: { organizationId: orgId },
    }),
  );
  if (!memberCountResult.ok) {
    return { success: false, error: "Unable to validate current membership" };
  }

  const pendingInviteCountResult = await runOrgScopedQuery(ctx, async (orgId) =>
    prisma.auditLog.count({
      where: {
        organizationId: orgId,
        action: "member:invite_pending",
      },
    }),
  );
  if (!pendingInviteCountResult.ok) {
    return { success: false, error: "Unable to validate pending invitations" };
  }

  const seatsInUse =
    memberCountResult.data + pendingInviteCountResult.data;

  if (
    subscriptionResult.data &&
    seatsInUse >= subscriptionResult.data.maxSeats
  ) {
    return {
      success: false,
      error: "Seat limit reached. Upgrade your plan to add more members.",
    };
  }

  const existingUserResult = await runOrgScopedQuery(ctx, async () =>
    prisma.user.findUnique({
      where: { email },
      select: { id: true },
    }),
  );
  if (!existingUserResult.ok) {
    return { success: false, error: "Unable to verify existing user account" };
  }
  const existingUser = existingUserResult.data;

  if (existingUser) {
    const existingMembershipResult = await runOrgScopedQuery(ctx, async (orgId) =>
      prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: existingUser.id,
            organizationId: orgId,
          },
        },
      }),
    );
    if (!existingMembershipResult.ok) {
      return {
        success: false,
        error: "Unable to validate existing organization membership",
      };
    }

    if (existingMembershipResult.data) {
      return {
        success: false,
        error: "This user is already a member of this organization",
      };
    }

    try {
      const inviteResult = await runOrgScopedQuery(ctx, async (orgId) => {
        await prisma.membership.create({
          data: {
            userId: existingUser.id,
            organizationId: orgId,
            role,
          },
        });

        await prisma.auditLog.create({
          data: {
            organizationId: orgId,
            userId: ctx.user.id,
            action: "member:invite",
            entityType: "membership",
            entityId: existingUser.id,
            metadata: { invitedEmail: email, role },
          },
        });
      });
      if (!inviteResult.ok) {
        return {
          success: false,
          error: "Failed to add member. Please try again.",
        };
      }

      revalidatePath("/settings/members");
      return { success: true, error: null };
    } catch (error) {
      console.error("[members] invite error:", error);
      return {
        success: false,
        error: "Failed to add member. Please try again.",
      };
    }
  }

  try {
    const pendingInviteResult = await runOrgScopedQuery(ctx, async (orgId) =>
      prisma.auditLog.create({
        data: {
          organizationId: orgId,
          userId: ctx.user.id,
          action: "member:invite_pending",
          entityType: "user",
          metadata: { invitedEmail: email, role },
        },
      }),
    );
    if (!pendingInviteResult.ok) {
      return {
        success: false,
        error: "Failed to send invitation. Please try again.",
      };
    }

    revalidatePath("/settings/members");
    return {
      success: true,
      error: null,
      info: "Invite recorded. Ask them to sign up with this email, then add them from Members once their account exists.",
    } as InviteMemberState & { info?: string };
  } catch (error) {
    console.error("[members] invite error:", error);
    return {
      success: false,
      error: "Failed to send invitation. Please try again.",
    };
  }
}

export async function changeMemberRoleAction(
  _prevState: RoleChangeState,
  formData: FormData,
): Promise<RoleChangeState> {
  const organizationId = (formData.get("organizationId") as string) ?? "";
  const membershipId = (formData.get("membershipId") as string) ?? "";
  const newRole = (formData.get("newRole") as MemberRole) ?? "";

  if (!organizationId || !membershipId || !newRole) {
    return { success: false, error: "Missing required fields" };
  }

  if (!MANAGEABLE_ROLES.includes(newRole) && newRole !== "OWNER") {
    return { success: false, error: "Invalid role selected" };
  }

  const ctx = await requireOrgAccess(organizationId);

  if (!hasPermission(ctx.role, "org:members:manage")) {
    return {
      success: false,
      error: "Only admins and owners can change member roles",
    };
  }

  const targetMembershipResult = await runOrgScopedQuery(ctx, async (orgId) =>
    prisma.membership.findFirst({
      where: {
        id: membershipId,
        organizationId: orgId,
      },
      include: {
        user: { select: { id: true, email: true } },
      },
    }),
  );
  if (!targetMembershipResult.ok) {
    return { success: false, error: "Unable to resolve member details" };
  }
  const targetMembership = targetMembershipResult.data;

  if (!targetMembership) {
    return { success: false, error: "Member not found" };
  }

  if (targetMembership.userId === ctx.user.id) {
    return {
      success: false,
      error: "You cannot change your own role. Ask another admin to do this.",
    };
  }

  if (!canManageRole(ctx.role, targetMembership.role)) {
    return {
      success: false,
      error: "You do not have permission to modify this member's role",
    };
  }

  if (!canChangeToRole(ctx.role, newRole)) {
    return {
      success: false,
      error: "You do not have permission to assign this role",
    };
  }

  if (targetMembership.role === "OWNER") {
    return {
      success: false,
      error:
        "Cannot change OWNER role directly. Use ownership transfer instead.",
    };
  }

  if (newRole === "OWNER") {
    return {
      success: false,
      error:
        "Cannot assign OWNER role directly. Use ownership transfer instead.",
    };
  }

  try {
    const roleChangeResult = await runOrgScopedQuery(ctx, async (orgId) => {
      await prisma.membership.update({
        where: { id: membershipId },
        data: { role: newRole },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          userId: ctx.user.id,
          action: "member:role_change",
          entityType: "membership",
          entityId: membershipId,
          metadata: {
            targetUserId: targetMembership.userId,
            targetUserEmail: targetMembership.user.email,
            oldRole: targetMembership.role,
            newRole,
          },
        },
      });
    });
    if (!roleChangeResult.ok) {
      return {
        success: false,
        error: "Failed to change role. Please try again.",
      };
    }

    revalidatePath("/settings/members");
    return { success: true, error: null };
  } catch (error) {
    console.error("[members] role change error:", error);
    return {
      success: false,
      error: "Failed to change role. Please try again.",
    };
  }
}

export async function removeMemberAction(
  _prevState: RemoveMemberState,
  formData: FormData,
): Promise<RemoveMemberState> {
  const organizationId = (formData.get("organizationId") as string) ?? "";
  const membershipId = (formData.get("membershipId") as string) ?? "";

  if (!organizationId || !membershipId) {
    return { success: false, error: "Missing required fields" };
  }

  const ctx = await requireOrgAccess(organizationId);

  if (!hasPermission(ctx.role, "org:members:manage")) {
    return {
      success: false,
      error: "Only admins and owners can remove members",
    };
  }

  const targetMembershipResult = await runOrgScopedQuery(ctx, async (orgId) =>
    prisma.membership.findFirst({
      where: {
        id: membershipId,
        organizationId: orgId,
      },
      include: {
        user: { select: { id: true, email: true } },
      },
    }),
  );
  if (!targetMembershipResult.ok) {
    return { success: false, error: "Unable to resolve member details" };
  }
  const targetMembership = targetMembershipResult.data;

  if (!targetMembership) {
    return { success: false, error: "Member not found" };
  }

  if (targetMembership.userId === ctx.user.id) {
    return {
      success: false,
      error: "You cannot remove yourself from the organization",
    };
  }

  if (!canManageRole(ctx.role, targetMembership.role)) {
    return {
      success: false,
      error: "You do not have permission to remove this member",
    };
  }

  if (targetMembership.role === "OWNER") {
    const ownerCountResult = await runOrgScopedQuery(ctx, async (orgId) =>
      prisma.membership.count({
        where: {
          organizationId: orgId,
          role: "OWNER",
        },
      }),
    );
    if (!ownerCountResult.ok) {
      return { success: false, error: "Unable to validate owner membership" };
    }

    if (ownerCountResult.data <= 1) {
      return {
        success: false,
        error: "Cannot remove the last owner. Transfer ownership first.",
      };
    }
  }

  try {
    const removeResult = await runOrgScopedQuery(ctx, async (orgId) => {
      await prisma.membership.delete({
        where: { id: membershipId },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          userId: ctx.user.id,
          action: "member:remove",
          entityType: "membership",
          entityId: membershipId,
          metadata: {
            removedUserId: targetMembership.userId,
            removedUserEmail: targetMembership.user.email,
            role: targetMembership.role,
          },
        },
      });
    });
    if (!removeResult.ok) {
      return {
        success: false,
        error: "Failed to remove member. Please try again.",
      };
    }

    revalidatePath("/settings/members");
    return { success: true, error: null };
  } catch (error) {
    console.error("[members] remove error:", error);
    return {
      success: false,
      error: "Failed to remove member. Please try again.",
    };
  }
}
