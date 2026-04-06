/** Best-effort client IP for rate limiting (may be unknown behind some proxies). */
export function getClientIpFromHeaders(h: { get: (name: string) => string | null }): string {
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const real = h.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}
