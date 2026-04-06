/**
 * Best-effort client IP for rate limiting (trusts X-Forwarded-For when present).
 */
export function getClientIpFromHeaders(headersList: {
  get(name: string): string | null;
}): string {
  const forwarded = headersList.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown";
  return ip || "unknown";
}
