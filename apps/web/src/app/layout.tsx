import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import {
  PRODUCT_DESCRIPTION,
  PRODUCT_DISPLAY_NAME,
  PRODUCT_SHORT_NAME,
  PRODUCT_TAGLINE,
} from "@/lib/product-brand";
import { getAppBaseUrl } from "@/lib/site-url";
import {
  siteDefaultOpenGraphImages,
  siteDefaultTwitterImages,
} from "@/lib/site-metadata";

const appBase = getAppBaseUrl();

export const metadata: Metadata = {
  metadataBase: new URL(appBase),
  title: {
    default: `${PRODUCT_DISPLAY_NAME} — ${PRODUCT_TAGLINE}`,
    template: `%s · ${PRODUCT_DISPLAY_NAME}`,
  },
  description: PRODUCT_DESCRIPTION,
  applicationName: PRODUCT_DISPLAY_NAME,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: PRODUCT_SHORT_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/brand/accessiblemadeflexible/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/accessiblemadeflexible/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/brand/accessiblemadeflexible/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    siteName: PRODUCT_DISPLAY_NAME,
    locale: "en_US",
    type: "website",
    url: appBase,
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0d9488" },
    { media: "(prefers-color-scheme: dark)", color: "#115e59" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr">
      <body className="min-h-dvh bg-[rgb(var(--color-canvas))]">{children}</body>
    </html>
  );
}
