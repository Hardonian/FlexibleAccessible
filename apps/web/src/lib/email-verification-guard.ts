/**
 * Paths a signed-in but unverified user may access before completing email verification.
 */
export function isEmailVerificationExemptPath(pathname: string): boolean {
  if (pathname === "/verify-email") return true;
  if (pathname === "/settings/billing" || pathname.startsWith("/settings/billing/"))
    return true;
  return false;
}
