import type { PlanTier } from "@aros/config";

export type ConfidenceLabel = {
  label: string;
  meaning: string;
  safeForExternalProof: boolean;
};

export const CONFIDENCE_LABELS: ConfidenceLabel[] = [
  {
    label: "Automated",
    meaning: "Detected by scan automation; not manually reviewed yet.",
    safeForExternalProof: true,
  },
  {
    label: "Guided",
    meaning: "Draft remediation guidance exists, but the change is not verified.",
    safeForExternalProof: true,
  },
  {
    label: "Reviewed",
    meaning: "A human reviewed triage or recommendation quality.",
    safeForExternalProof: true,
  },
  {
    label: "Verified",
    meaning: "A follow-up crawl confirms the issue condition changed as expected.",
    safeForExternalProof: true,
  },
  {
    label: "Assured",
    meaning:
      "A managed-service or contractual lane accepted accountability for this scope.",
    safeForExternalProof: false,
  },
  {
    label: "Stale",
    meaning: "Evidence is older than policy tolerance and needs a fresh run.",
    safeForExternalProof: true,
  },
  {
    label: "Degraded",
    meaning: "Platform dependencies are impaired, so coverage or automation is reduced.",
    safeForExternalProof: true,
  },
  {
    label: "Not comparable",
    meaning:
      "Runs cannot be reliably compared (scope drift, failed run, or missing baseline).",
    safeForExternalProof: true,
  },
  {
    label: "Proof incomplete",
    meaning: "Export exists but excludes required evidence lineage or review metadata.",
    safeForExternalProof: true,
  },
];

export type PlanCommitment = {
  heading: string;
  detail: string;
};

const PLAN_COMMITMENTS: Record<PlanTier, PlanCommitment[]> = {
  FREE: [
    {
      heading: "Public sample only",
      detail:
        "Public scans are bounded and expire. They provide orientation, not ongoing assurance.",
    },
    {
      heading: "No response SLA",
      detail:
        "Community-grade support only; no guaranteed response window.",
    },
  ],
  STARTER: [
    {
      heading: "Private workspace continuity",
      detail:
        "Historical scans and findings remain available while subscription is active.",
    },
    {
      heading: "Re-scan after remediation",
      detail:
        "Teams can trigger verification scans after applying fixes, subject to plan scan limits.",
    },
  ],
  PROFESSIONAL: [
    {
      heading: "Review lane visibility",
      detail:
        "Review queues and status trails distinguish automated signals from reviewed decisions.",
    },
    {
      heading: "Operational proof exports",
      detail:
        "Report exports include remediation state and timestamps suitable for buyer updates.",
    },
  ],
  ENTERPRISE: [
    {
      heading: "Contract-shaped commitments",
      detail:
        "Priority response windows and specialist review terms apply only when written into contract scope.",
    },
    {
      heading: "Managed assurance lane",
      detail:
        "Optional managed operations can include expert triage and verification cadence by SOW.",
    },
  ],
};

export function getPlanCommitments(tier: PlanTier): PlanCommitment[] {
  return PLAN_COMMITMENTS[tier];
}
