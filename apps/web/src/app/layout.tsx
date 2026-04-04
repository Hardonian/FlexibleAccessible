import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import {
  PRODUCT_DESCRIPTION,
  PRODUCT_DISPLAY_NAME,
  PRODUCT_SHORT_NAME,
  PRODUCT_TAGLINE,
} from "@/lib/product-brand";

export const metadata: Metadata = {
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
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
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
