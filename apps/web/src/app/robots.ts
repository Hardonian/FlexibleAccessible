import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = getAppBaseUrl();
  const { host } = new URL(base);

  return {
    rules: {
      userAgent: "*",
      disallow: [
        "/dashboard/",
        "/settings/",
        "/login",
        "/signup",
        "/forgot-password",
        "/reset-password/",
        "/verify-email",
        "/api/",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host,
  };
}
