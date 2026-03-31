import path from "path";
import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  reloadOnOnline: true,
  /** Logged-in vs logged-out start URL differs; avoid precaching a single HTML shell. */
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
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  transpilePackages: [
    "@aros/db",
    "@aros/core-services",
    "@aros/config",
    "@aros/shared",
  ],
  serverExternalPackages: ["bullmq"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default withPWA(nextConfig);
