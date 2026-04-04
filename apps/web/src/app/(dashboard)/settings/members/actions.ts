"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requireOrgAccess } from "@/lib/auth-guard";
import { hasPermission } from "@aros/config";
import { ApiError } from "@aros/shared";
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

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    select: { maxSeats: true },
  });

  const currentMemberCount = await prisma.membership.count({
    where: { organizationId },
  });

  if (subscription && currentMemberCount >= subscription.maxSeats) {
    return {
      success: false,
      error: "Seat limit reached. Upgrade your plan to add more members.",
    };
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    const existingMembership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: existingUser.id,
          organizationId,
        },
      },
    });

    if (existingMembership) {
      return {
        success: false,
        error: "This user is already a member of this organization",
      };
    }

    try {
      await prisma.membership.create({
        data: {
          userId: existingUser.id,
          organizationId,
          role,
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId,
          userId: ctx.user.id,
          action: "member:invite",
          entityType: "membership",
          entityId: existingUser.id,
          metadata: { invitedEmail: email, role },
        },
      });

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
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId: ctx.user.id,
        action: "member:invite_pending",
        entityType: "user",
        metadata: { invitedEmail: email, role },
      },
    });

    revalidatePath("/settings/members");
    return {
      success: true,
      error: null,
      info: "Invitation recorded. User will need to sign up to join.",
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

  const targetMembership = await prisma.membership.findFirst({
    where: {
      id: membershipId,
      organizationId,
    },
    include: {
      user: { select: { id: true, email: true } },
    },
  });

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
    await prisma.membership.update({
      where: { id: membershipId },
      data: { role: newRole },
    });

    await prisma.auditLog.create({
      data: {
        organizationId,
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

  const targetMembership = await prisma.membership.findFirst({
    where: {
      id: membershipId,
      organizationId,
    },
    include: {
      user: { select: { id: true, email: true } },
    },
  });

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
    const ownerCount = await prisma.membership.count({
      where: {
        organizationId,
        role: "OWNER",
      },
    });

    if (ownerCount <= 1) {
      return {
        success: false,
        error: "Cannot remove the last owner. Transfer ownership first.",
      };
    }
  }

  try {
    await prisma.membership.delete({
      where: { id: membershipId },
    });

    await prisma.auditLog.create({
      data: {
        organizationId,
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
