/**
 * Canonical time-to-live for anonymous public scan artifacts (DB row + API).
 * Must stay aligned with POST /api/public-scan record creation and worker completion updates.
 */
export const PUBLIC_SCAN_EVIDENCE_TTL_MS = 24 * 60 * 60 * 1000;
