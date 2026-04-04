import {
  getLatestValidPublicScanForDomain,
  getPublicScanEvidenceState,
} from "./validity";

export type PublicOgRenderModel = {
  displayDomain: string;
  hasCurrentProof: boolean;
  score: number | null;
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  total: number;
  headline: string;
  scoreDisplay: string;
  scoreColor: string;
};

export async function getPublicOgRenderModel(
  displayDomain: string,
): Promise<PublicOgRenderModel> {
  const scan = await getLatestValidPublicScanForDomain(displayDomain, {
    requireCompleted: true,
  });
  const evidenceState = getPublicScanEvidenceState(scan);
  const hasCurrentProof = evidenceState === "valid" && scan?.score !== null;

  const score = hasCurrentProof ? (scan!.score as number) : null;
  const critical = hasCurrentProof ? scan!.criticalCount : 0;
  const serious = hasCurrentProof ? scan!.seriousCount : 0;
  const moderate = hasCurrentProof ? scan!.moderateCount : 0;
  const minor = hasCurrentProof ? scan!.minorCount : 0;
  const total = critical + serious + moderate + minor;

  const scoreColor = !hasCurrentProof
    ? "#64748b"
    : score! >= 90
      ? "#22c55e"
      : score! >= 70
        ? "#eab308"
        : score! >= 50
          ? "#f97316"
          : "#ef4444";

  const headline = !hasCurrentProof
    ? "No current public scan evidence"
    : `${total} automated issues (sampled pages)`;

  const scoreDisplay = hasCurrentProof ? String(score) : "—";

  return {
    displayDomain,
    hasCurrentProof,
    score,
    critical,
    serious,
    moderate,
    minor,
    total,
    headline,
    scoreDisplay,
    scoreColor,
  };
}
