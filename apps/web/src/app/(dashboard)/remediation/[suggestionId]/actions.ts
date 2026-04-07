"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { hasPermission } from "@aros/config";
import { requireOrgAccess } from "@/lib/auth-guard";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import { resolveDashboardOrgMembership } from "@/lib/route-data-boundary";
import {
  loadRemediationSuggestionForOrg,
  updateRemediationSuggestionApproved,
  updateRemediationSuggestionExported,
  updateRemediationSuggestionRejected,
} from "@/lib/dashboard-org-scoped-prisma";

export async function approveSuggestionAction(formData: FormData) {
  const user = await requireSession();
  const suggestionId = (formData.get("suggestionId") as string) || "";

  if (!suggestionId) {
    redirect("/remediation?error=missing_id");
  }

  const platformTruth = await getRoutePlatformTruth();
  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);
  if (orgRes.kind !== "ok") {
    redirect("/remediation?error=not_found");
  }

  const { role, entitlement } = await requireOrgAccess(
    orgRes.organizationId,
    "suggestion:approve",
    { requirePaid: true },
  );

  if (!entitlement.hasPaidAccess) {
    redirect("/settings/billing?status=upgrade_required&from=%2Fremediation");
  }

  if (!hasPermission(role, "suggestion:approve")) {
    redirect(`/remediation/${suggestionId}?error=forbidden`);
  }

  const suggestion = await loadRemediationSuggestionForOrg(
    suggestionId,
    orgRes.organizationId,
  );
  if (!suggestion) {
    redirect("/remediation?error=not_found");
  }

  if (suggestion.status !== "DRAFT" && suggestion.status !== "VALIDATED") {
    redirect(`/remediation/${suggestionId}?error=invalid_transition`);
  }

  const outcome = await updateRemediationSuggestionApproved(
    suggestionId,
    orgRes.organizationId,
    user.id,
  );
  if (!outcome.ok) {
    redirect(`/remediation/${suggestionId}?error=update_failed`);
  }

  redirect(`/remediation/${suggestionId}`);
}

export async function rejectSuggestionAction(formData: FormData) {
  const user = await requireSession();
  const suggestionId = (formData.get("suggestionId") as string) || "";

  if (!suggestionId) {
    redirect("/remediation?error=missing_id");
  }

  const platformTruth = await getRoutePlatformTruth();
  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);
  if (orgRes.kind !== "ok") {
    redirect("/remediation?error=not_found");
  }

  const { role, entitlement } = await requireOrgAccess(
    orgRes.organizationId,
    "suggestion:approve",
    { requirePaid: true },
  );

  if (!entitlement.hasPaidAccess) {
    redirect("/settings/billing?status=upgrade_required&from=%2Fremediation");
  }

  if (!hasPermission(role, "suggestion:approve")) {
    redirect(`/remediation/${suggestionId}?error=forbidden`);
  }

  const suggestion = await loadRemediationSuggestionForOrg(
    suggestionId,
    orgRes.organizationId,
  );
  if (!suggestion) {
    redirect("/remediation?error=not_found");
  }

  if (suggestion.status === "REJECTED" || suggestion.status === "APPLIED") {
    redirect(`/remediation/${suggestionId}?error=invalid_transition`);
  }

  const outcome = await updateRemediationSuggestionRejected(
    suggestionId,
    orgRes.organizationId,
  );
  if (!outcome.ok) {
    redirect(`/remediation/${suggestionId}?error=update_failed`);
  }

  redirect(`/remediation/${suggestionId}`);
}

export async function exportSnippetAction(formData: FormData) {
  const user = await requireSession();
  const suggestionId = (formData.get("suggestionId") as string) || "";

  if (!suggestionId) {
    redirect("/remediation?error=missing_id");
  }

  const platformTruth = await getRoutePlatformTruth();
  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);
  if (orgRes.kind !== "ok") {
    redirect("/remediation?error=not_found");
  }

  const { role, entitlement } = await requireOrgAccess(
    orgRes.organizationId,
    "suggestion:export",
    { requirePaid: true },
  );

  if (!entitlement.hasPaidAccess) {
    redirect("/settings/billing?status=upgrade_required&from=%2Fremediation");
  }

  if (!hasPermission(role, "suggestion:export")) {
    redirect(`/remediation/${suggestionId}?error=forbidden`);
  }

  const suggestion = await loadRemediationSuggestionForOrg(
    suggestionId,
    orgRes.organizationId,
  );
  if (!suggestion) {
    redirect("/remediation?error=not_found");
  }

  if (suggestion.status !== "APPROVED" && suggestion.status !== "VALIDATED") {
    redirect(`/remediation/${suggestionId}?error=invalid_transition`);
  }

  const outcome = await updateRemediationSuggestionExported(
    suggestionId,
    orgRes.organizationId,
  );
  if (!outcome.ok) {
    redirect(`/remediation/${suggestionId}?error=update_failed`);
  }

  redirect(`/remediation/${suggestionId}`);
}
