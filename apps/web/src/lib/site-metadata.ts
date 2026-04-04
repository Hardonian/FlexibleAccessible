import type { Metadata } from "next";
import {
  pageTitle,
  PRODUCT_DESCRIPTION,
  PRODUCT_DISPLAY_NAME,
  PRODUCT_TAGLINE,
} from "@/lib/product-brand";
import { getAppBaseUrl } from "@/lib/site-url";

/** Canonical dimensions for dynamic OG images from `/api/og`. */
export const SITE_OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/**
 * Default marketing share image (no domain-specific claims).
 * Public scan pages continue to use `/api/og?domain=…` for evidence-backed previews.
 */
export const SITE_DEFAULT_OG_IMAGE_PATH = "/api/og?kind=site" as const;

export function siteDefaultOpenGraphImages(): NonNullable<
  NonNullable<Metadata["openGraph"]>["images"]
> {
  return [
    {
      url: SITE_DEFAULT_OG_IMAGE_PATH,
      width: SITE_OG_IMAGE_SIZE.width,
      height: SITE_OG_IMAGE_SIZE.height,
      alt: `${PRODUCT_DISPLAY_NAME} — ${PRODUCT_TAGLINE}`,
    },
  ];
}

export function siteDefaultTwitterImages(): string[] {
  return [SITE_DEFAULT_OG_IMAGE_PATH];
}

/** Short lines for OG card body — grounded, non-compliance claims. */
export const SITE_OG_BULLET_LINES = [
  "Browser-accurate scans and clustered root causes",
  "Review queues, exports, and org-scoped API keys",
  "Bounded draft assist where enabled — human review gates",
] as const;

export function siteMarketingJsonLd(baseUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: PRODUCT_DISPLAY_NAME,
    url: baseUrl,
    description: PRODUCT_DESCRIPTION,
  };
}

/** Consistent OG/Twitter for static marketing routes under MarketingSiteChrome. */
export function marketingSurfaceMetadata(
  segment: string,
  description: string,
  path: `/${string}`,
): Metadata {
  const base = getAppBaseUrl();
  const url = `${base}${path}`;
  return {
    title: pageTitle(segment),
    description,
    alternates: { canonical: path },
    openGraph: {
      title: pageTitle(segment),
      description,
      url,
      type: "website",
      siteName: PRODUCT_DISPLAY_NAME,
      locale: "en_US",
      images: siteDefaultOpenGraphImages(),
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle(segment),
      description,
      images: siteDefaultTwitterImages(),
    },
  };
}
