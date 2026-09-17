"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { resolveDashboardOrgMembership } from "@/lib/route-data-boundary";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import { requireOrgAccess } from "@/lib/auth-guard";
import {
  StakeholderRegistry,
  FeedbackLoopManager,
  BiasAuditEngine,
  type StakeholderSegment,
  type PowerLevel,
  type InterestLevel,
  type AccessibilityNeed,
  type FeedbackCategory,
} from "@aros/stakeholders";

const registry = new StakeholderRegistry();
const feedbackManager = new FeedbackLoopManager();
const biasEngine = new BiasAuditEngine();

export async function createStakeholderAction(formData: FormData) {
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind !== "ok") {
    return { success: false, error: "Organization context not found." };
  }

  try {
    await requireOrgAccess(orgRes.organizationId, "finding:manage", {
      requirePaid: true,
    });
  } catch {
    return { success: false, error: "Paid organization access required." };
  }

  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const role = (formData.get("role") as string)?.trim() || "Advocate";
  const segment = (formData.get("segment") as StakeholderSegment) || "END_USERS_WITH_DISABILITIES";
  const power = (formData.get("power") as PowerLevel) || "MEDIUM";
  const interest = (formData.get("interest") as InterestLevel) || "HIGH";
  const phone = (formData.get("phone") as string)?.trim() || undefined;
  const preferredChannel = (formData.get("preferredChannel") as any) || "EMAIL";
  const notes = (formData.get("notes") as string)?.trim() || undefined;

  const rawNeeds = formData.getAll("accessibilityNeeds") as string[];
  const accessibilityNeeds = rawNeeds.filter(Boolean) as AccessibilityNeed[];

  const rawGroups = formData.getAll("underrepresentedGroups") as string[];
  const underrepresentedGroups = rawGroups.filter(Boolean);

  if (!name || !email) {
    return { success: false, error: "Name and email are required." };
  }

  try {
    await registry.create({
      name,
      email,
      role,
      segment,
      power,
      interest,
      phone,
      preferredChannel,
      accessibilityNeeds,
      underrepresentedGroups,
      notes,
      organization: orgRes.organizationId,
      engagementStatus: "ACTIVE",
    });

    revalidatePath("/stakeholders");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create stakeholder";
    return { success: false, error: message };
  }
}

export async function submitStakeholderFeedbackAction(formData: FormData) {
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind !== "ok") {
    return { success: false, error: "Organization context not found." };
  }

  try {
    await requireOrgAccess(orgRes.organizationId, "finding:manage", {
      requirePaid: true,
    });
  } catch {
    return { success: false, error: "Paid organization access required." };
  }

  const stakeholderId = (formData.get("stakeholderId") as string)?.trim();
  const category = (formData.get("category") as FeedbackCategory) || "BARRIER";
  const content = (formData.get("content") as string)?.trim();
  const affectedUrl = (formData.get("affectedUrl") as string)?.trim() || undefined;
  const sentiment = (formData.get("sentiment") as any) || "NEUTRAL";
  const urgency = (formData.get("urgency") as any) || "MEDIUM";

  if (!content) {
    return { success: false, error: "Feedback content is required." };
  }

  try {
    await feedbackManager.create({
      stakeholderId: stakeholderId || "general",
      stakeholderName: "Accessibility Contributor",
      category,
      priority: urgency === "HIGH" ? "HIGH" : "MEDIUM",
      title: content.slice(0, 60),
      description: content,
      source: "PORTAL",
    });

    revalidatePath("/stakeholders");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record feedback";
    return { success: false, error: message };
  }
}
