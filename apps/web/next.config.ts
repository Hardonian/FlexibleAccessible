import path from "path";
import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const pwaEnabled =
  process.env.NODE_ENV === "production" && process.env.ENABLE_PWA === "true";

const withPWA = withPWAInit({
  dest: "public",
  disable: !pwaEnabled,
  register: pwaEnabled,
  reloadOnOnline: true,
  cacheStartUrl: false,
  dynamicStartUrl: true,
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "google-fonts",
          expiration: { maxEntries: 16, maxAgeSeconds: 60 * 60 * 24 * 365 },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  transpilePackages: [
    "@aros/db",
    "@aros/core-services",
    "@aros/config",
    "@aros/shared",
    "@aros/ui",
    "@aros/stakeholders",
    "@aros/scan-engine",
  ],
  serverExternalPackages: ["bullmq"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    return [
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
