"use client";

import { useState, useTransition } from "react";
import {
  MoreHorizontal,
  Shield,
  User,
  UserCog,
  UserCheck,
  Eye,
  Code,
  AlertTriangle,
  X,
  Check,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { EmptyState, LoadingSpinner } from "@aros/ui";
import { changeMemberRoleAction, removeMemberAction } from "./actions";
import { InviteForm } from "./invite-form";
import type { MemberRole } from "@aros/db";

interface Member {
  id: string;
  userId: string;
  role: MemberRole;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface MembersListProps {
  organizationId: string;
  members: Member[];
  currentUserId: string;
  currentUserRole: MemberRole;
  canManageMembers: boolean;
}

const ROLE_META: Record<
  MemberRole,
  { label: string; icon: React.ElementType; description: string; color: string }
> = {
  OWNER: {
    label: "Owner",
    icon: Shield,
    description: "Full organization control",
    color: "bg-purple-100 text-purple-800",
  },
  ADMIN: {
    label: "Admin",
    icon: UserCog,
    description: "Manage members and settings",
    color: "bg-blue-100 text-blue-800",
  },
  DEVELOPER: {
    label: "Developer",
    icon: Code,
    description: "Run scans and manage findings",
    color: "bg-green-100 text-green-800",
  },
  CONTENT_EDITOR: {
    label: "Content Editor",
    icon: UserCheck,
    description: "Approve suggestions and edit content",
    color: "bg-amber-100 text-amber-800",
  },
  AUDITOR: {
    label: "Auditor",
    icon: Eye,
    description: "Review and audit access",
    color: "bg-cyan-100 text-cyan-800",
  },
  REVIEWER: {
    label: "Reviewer",
    icon: User,
    description: "Review remediation suggestions",
    color: "bg-slate-100 text-slate-800",
  },
};

const CHANGEABLE_ROLES: MemberRole[] = [
  "ADMIN",
  "DEVELOPER",
  "CONTENT_EDITOR",
  "AUDITOR",
  "REVIEWER",
];

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
    return CHANGEABLE_ROLES.includes(newRole);
  }
  return false;
}

export function MembersList({
  organizationId,
  members,
  currentUserId,
  currentUserRole,
  canManageMembers,
}: MembersListProps) {
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<MemberRole | null>(null);
  const [roleChangeError, setRoleChangeError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isRolePending, startRoleTransition] = useTransition();
  const [isRemovePending, startRemoveTransition] = useTransition();

  const sortedMembers = [...members].sort((a, b) => {
    const roleOrder = [
      "OWNER",
      "ADMIN",
      "DEVELOPER",
      "CONTENT_EDITOR",
      "AUDITOR",
      "REVIEWER",
    ];
    const aIndex = roleOrder.indexOf(a.role);
    const bIndex = roleOrder.indexOf(b.role);
    if (aIndex !== bIndex) return aIndex - bIndex;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  async function handleRoleChange(formData: FormData) {
    setRoleChangeError(null);

    startRoleTransition(async () => {
      const result = await changeMemberRoleAction(
        { success: false, error: null },
        formData,
      );

      if (result.success) {
        setEditingMemberId(null);
        setSelectedRole(null);
      } else {
        setRoleChangeError(result.error);
      }
    });
  }

  async function handleRemove(formData: FormData) {
    setRemoveError(null);

    startRemoveTransition(async () => {
      const result = await removeMemberAction(
        { success: false, error: null },
        formData,
      );

      if (result.success) {
        setRemovingMemberId(null);
      } else {
        setRemoveError(result.error);
      }
    });
  }

  function startEditing(member: Member) {
    setEditingMemberId(member.id);
    setSelectedRole(member.role);
    setRoleChangeError(null);
  }

  function startRemoving(memberId: string) {
    setRemovingMemberId(memberId);
    setRemoveError(null);
  }

  const availableRolesForChange = CHANGEABLE_ROLES.filter((role) =>
    canChangeToRole(currentUserRole, role),
  );

  return (
    <div className="space-y-6">
      {canManageMembers && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {members.length} member{members.length !== 1 ? "s" : ""}
          </p>
          <InviteForm
            organizationId={organizationId}
            canInviteAdmin={
              currentUserRole === "OWNER" || currentUserRole === "ADMIN"
            }
          />
        </div>
      )}

      {members.length === 0 ? (
        <EmptyState
          icon={User}
          title="No members yet"
          description="Invite team members to collaborate on accessibility improvements."
          className="card"
        />
      ) : (
        <div className="space-y-3">
          {sortedMembers.map((member) => {
            const isCurrentUser = member.userId === currentUserId;
            const canManage =
              canManageMembers && canManageRole(currentUserRole, member.role);
            const isEditing = editingMemberId === member.id;
            const isRemoving = removingMemberId === member.id;
            const roleMeta = ROLE_META[member.role];
            const RoleIcon = roleMeta.icon;

            return (
              <div
                key={member.id}
                className={`card ${isCurrentUser ? "border-brand-200" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-900">
                        {member.user.name ?? "Unnamed"}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            (You)
                          </span>
                        )}
                      </h3>
                      <span
                        className={`badge ${roleMeta.color} flex items-center gap-1`}
                      >
                        <RoleIcon className="h-3 w-3" />
                        {roleMeta.label}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">
                      {member.user.email}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Joined {formatDate(member.createdAt)}
                    </p>
                  </div>

                  {canManage && !isCurrentUser && (
                    <div className="flex items-center gap-2 shrink-0">
                      {isEditing ? (
                        <form
                          action={handleRoleChange}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="hidden"
                            name="organizationId"
                            value={organizationId}
                          />
                          <input
                            type="hidden"
                            name="membershipId"
                            value={member.id}
                          />
                          <div className="relative">
                            <select
                              name="newRole"
                              value={selectedRole ?? member.role}
                              onChange={(e) =>
                                setSelectedRole(e.target.value as MemberRole)
                              }
                              className="input text-sm py-1 pr-8"
                              disabled={isRolePending}
                            >
                              {availableRolesForChange.map((role) => (
                                <option key={role} value={role}>
                                  {ROLE_META[role].label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                          </div>
                          <button
                            type="submit"
                            className="btn-primary text-xs px-2 py-1"
                            disabled={
                              isRolePending || selectedRole === member.role
                            }
                          >
                            {isRolePending ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMemberId(null);
                              setSelectedRole(null);
                              setRoleChangeError(null);
                            }}
                            className="btn-secondary text-xs px-2 py-1"
                            disabled={isRolePending}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </form>
                      ) : isRemoving ? (
                        <form
                          action={handleRemove}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="hidden"
                            name="organizationId"
                            value={organizationId}
                          />
                          <input
                            type="hidden"
                            name="membershipId"
                            value={member.id}
                          />
                          <span className="text-xs text-red-600 font-medium">
                            Confirm removal?
                          </span>
                          <button
                            type="submit"
                            className="btn-danger text-xs px-2 py-1"
                            disabled={isRemovePending}
                          >
                            {isRemovePending ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              "Remove"
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRemovingMemberId(null);
                              setRemoveError(null);
                            }}
                            className="btn-secondary text-xs px-2 py-1"
                            disabled={isRemovePending}
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditing(member)}
                            className="btn-secondary text-xs px-2 py-1"
                            disabled={member.role === "OWNER"}
                            title={
                              member.role === "OWNER"
                                ? "Cannot change owner role directly"
                                : "Change role"
                            }
                          >
                            Change Role
                          </button>
                          <button
                            type="button"
                            onClick={() => startRemoving(member.id)}
                            className="btn-danger text-xs px-2 py-1"
                            title="Remove member"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {isEditing && roleChangeError && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    {roleChangeError}
                  </div>
                )}

                {isRemoving && removeError && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    {removeError}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
