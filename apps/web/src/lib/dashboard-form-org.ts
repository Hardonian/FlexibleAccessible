/**
 * Validates that a server action received the same organization the page rendered under.
 * Mitigates stale forms after org switch / multi-tab without weakening scoped queries.
 */
export function parseExpectedOrgFromForm(formData: FormData): string | null {
  const raw = formData.get("expectedOrganizationId");
  if (raw == null) return null;
  const s = String(raw).trim();
  return s.length > 0 ? s : null;
}

export function assertFormOrgMatchesActive(
  expectedFromForm: string | null,
  activeOrganizationId: string,
): boolean {
  if (!expectedFromForm) return true;
  return expectedFromForm === activeOrganizationId;
}
