/**
 * Canonical product identity for user-facing surfaces (marketing, app chrome, metadata).
 * Package and API identifiers remain @aros/*; this is the commercial product name.
 *
 * BRAND: AccessibleMadeFlexible
 * Internal engine: AROS (Accessibility Remediation OS) — @aros/* packages
 */
export const PRODUCT_DISPLAY_NAME = "AccessibleMadeFlexible" as const;

export const PRODUCT_TAGLINE =
  "Accessibility operations and evidence—not vanity scores." as const;

export const PRODUCT_DESCRIPTION =
  "A trustworthy platform for teams that need to detect, prove, prioritize, communicate, and improve accessibility with browser-accurate scans, clustered findings, exports, and workflows that hold up under review." as const;

/** PWA / compact labels */
export const PRODUCT_SHORT_NAME = "AMF" as const;

export const PRODUCT_LEGAL_LINE =
  "Ships on the AROS engine (@aros/* packages)—same scanning core the CLI and MCP use." as const;

/**
 * Procurement / managed-services contact. Set `NEXT_PUBLIC_PRODUCT_CONTACT_EMAIL`
 * in production to your buyer-facing address (see `.env.example`).
 */
export const PRODUCT_CONTACT_EMAIL =
  process.env.NEXT_PUBLIC_PRODUCT_CONTACT_EMAIL?.trim() || "sales@aros.dev";

/** Brand asset paths — all relative to /public */
export const BRAND_ASSETS = {
  /** Standalone brand mark (transparent background) */
  mark: "/brand/accessiblemadeflexible/mark.svg",
  /** Horizontal logo: mark + wordmark (transparent background) */
  logoHorizontal: "/brand/accessiblemadeflexible/logo-horizontal.svg",
  /** Stacked wordmark (transparent background) */
  logoStacked: "/brand/accessiblemadeflexible/logo-stacked.svg",
  /** PWA icon 192×192 */
  icon192: "/icons/icon-192.png",
  /** PWA icon 512×512 */
  icon512: "/icons/icon-512.png",
} as const;

export function pageTitle(segment: string): string {
  return `${segment} · ${PRODUCT_DISPLAY_NAME}`;
}
