import type { Metadata } from "next";
import { HomePageClient } from "./home-page-client";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import {
  PRODUCT_DESCRIPTION,
  PRODUCT_DISPLAY_NAME,
  PRODUCT_TAGLINE,
} from "@/lib/product-brand";
import { getAppBaseUrl } from "@/lib/site-url";
import { homeFaqs, productFeatures } from "@/lib/marketing-content";
import {
  siteDefaultOpenGraphImages,
  siteDefaultTwitterImages,
  siteMarketingJsonLd,
} from "@/lib/site-metadata";

const baseUrl = getAppBaseUrl();

export const metadata: Metadata = {
  title: {
    absolute: `${PRODUCT_DISPLAY_NAME} — ${PRODUCT_TAGLINE}`,
  },
  description: PRODUCT_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    siteName: PRODUCT_DISPLAY_NAME,
    title: `${PRODUCT_DISPLAY_NAME} — ${PRODUCT_TAGLINE}`,
    description: PRODUCT_DESCRIPTION,
    images: siteDefaultOpenGraphImages(),
  },
  twitter: {
    card: "summary_large_image",
    title: `${PRODUCT_DISPLAY_NAME} — ${PRODUCT_TAGLINE}`,
    description: PRODUCT_DESCRIPTION,
    images: siteDefaultTwitterImages(),
  },
};

export default function HomePage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: homeFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const softwareSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: PRODUCT_DISPLAY_NAME,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    description: PRODUCT_DESCRIPTION,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description:
        "Free instant public scan with limits; paid workspaces for full coverage.",
    },
    featureList: productFeatures.map((f) => f.title),
  };

  const orgSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: PRODUCT_DISPLAY_NAME,
    url: baseUrl,
    description: PRODUCT_DESCRIPTION,
  };

  const webSiteSchema = siteMarketingJsonLd(baseUrl);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema).replace(/</g, '\\u003c') }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, '\\u003c') }}
      />
      <MarketingSiteChrome>
        <HomePageClient />
      </MarketingSiteChrome>
    </>
  );
}
