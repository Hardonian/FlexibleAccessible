"use client";

import { useState, useTransition } from "react";
import { UserPlus, X, Check } from "lucide-react";
import { LoadingSpinner } from "@aros/ui";
import { inviteMemberAction } from "./actions";
import type { MemberRole } from "@aros/db";

const INVITABLE_ROLES: {
  value: MemberRole;
  label: string;
  description: string;
}[] = [
  {
    value: "DEVELOPER",
    label: "Developer",
    description: "Can view sites, run scans, and manage findings",
  },
  {
    value: "CONTENT_EDITOR",
    label: "Content Editor",
    description: "Can view findings and approve suggestions",
  },
  {
    value: "AUDITOR",
    label: "Auditor",
    description: "Full view access with review and audit capabilities",
  },
  {
    value: "REVIEWER",
    label: "Reviewer",
    description: "Can review and approve remediation suggestions",
  },
  {
    value: "ADMIN",
    label: "Admin",
    description: "Full access except billing and ownership transfer",
  },
];

interface InviteFormProps {
  organizationId: string;
  canInviteAdmin: boolean;
}

interface InviteState {
  success: boolean;
  error: string | null;
  info?: string;
}

export function InviteForm({
  organizationId,
  canInviteAdmin,
}: InviteFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<MemberRole>("DEVELOPER");
  const [inviteState, setInviteState] = useState<InviteState>({
    success: false,
    error: null,
  });
  const [isPending, startTransition] = useTransition();

  const availableRoles = canInviteAdmin
    ? INVITABLE_ROLES
    : INVITABLE_ROLES.filter((r) => r.value !== "ADMIN");

  async function handleSubmit(formData: FormData) {
    setInviteState({ success: false, error: null });

    startTransition(async () => {
      const result = await inviteMemberAction(
        { success: false, error: null },
        formData,
      );

      if (result.success) {
        setInviteState({
          success: true,
          error: null,
          info: (result as InviteState).info,
        });
        setEmail("");
        setTimeout(() => {
          setIsOpen(false);
          setInviteState({ success: false, error: null });
        }, 2000);
      } else {
        setInviteState({
          success: false,
          error: result.error,
        });
      }
    });
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="btn-primary"
      >
        <UserPlus className="h-4 w-4 mr-2" />
        Invite Member
      </button>
    );
  }

  return (
    <div className="card border-brand-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">Invite Member</h3>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setInviteState({ success: false, error: null });
            setEmail("");
          }}
          className="text-slate-400 hover:text-slate-600"
          aria-label="Close invite form"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form action={handleSubmit} className="space-y-4">
        <input type="hidden" name="organizationId" value={organizationId} />

        <div>
          <label htmlFor="invite-email" className="label">
            Email Address
          </label>
          <input
            id="invite-email"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            required
            className="input"
            disabled={isPending}
          />
          <p className="mt-1 text-xs text-slate-500">
            They will receive an invitation to join this organization.
          </p>
        </div>

        <div>
          <label className="label">Role</label>
          <div className="space-y-2">
            {availableRoles.map((role) => (
              <label
                key={role.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedRole === role.value
                    ? "border-brand-300 bg-brand-50"
                    : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={role.value}
                  checked={selectedRole === role.value}
                  onChange={() => setSelectedRole(role.value)}
                  className="mt-1 h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-600"
                  disabled={isPending}
                />
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {role.label}
                  </p>
                  <p className="text-xs text-slate-500">{role.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {inviteState.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {inviteState.error}
          </div>
        )}

        {inviteState.success && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 flex items-center gap-2">
            <Check className="h-4 w-4" />
            {inviteState.info || "Invitation sent successfully!"}
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="btn-primary"
            disabled={isPending || !email}
          >
            {isPending ? (
              <LoadingSpinner size="sm" label="Sending..." />
            ) : (
              "Send Invitation"
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setInviteState({ success: false, error: null });
              setEmail("");
            }}
            className="btn-secondary"
            disabled={isPending}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
