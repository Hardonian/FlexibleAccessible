/**
 * Canonical public origin for the web app (metadata, OG URLs, billing redirects, share links).
 * Prefer NEXT_PUBLIC_APP_URL in production so previews and metadata stay correct when NEXTAUTH_URL is unset.
 */
export function getAppBaseUrl(): string {
  const explicit = normalizeConfiguredBaseUrl(process.env.NEXT_PUBLIC_APP_URL);
  if (explicit) return explicit;

  const normalizedNextAuthUrl = normalizeConfiguredBaseUrl(
    process.env.NEXTAUTH_URL,
  );
  if (normalizedNextAuthUrl) return normalizedNextAuthUrl;

  const normalizedVercelUrl = normalizeConfiguredBaseUrl(
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  );
  if (normalizedVercelUrl) return normalizedVercelUrl;

  return "http://localhost:3000";
}

function normalizeConfiguredBaseUrl(input: string | undefined): string | null {
  if (!input) return null;

  try {
    const parsed = new URL(input);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}
