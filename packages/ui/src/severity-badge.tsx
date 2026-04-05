import { SeverityChip, type SeverityLevel } from "./severity-chip";

interface SeverityBadgeProps {
  severity: SeverityLevel;
}

/** @deprecated Prefer `SeverityChip` for new code — same visuals, clearer name. */
export function SeverityBadge({ severity }: SeverityBadgeProps) {
  return <SeverityChip severity={severity} size="sm" />;
}
