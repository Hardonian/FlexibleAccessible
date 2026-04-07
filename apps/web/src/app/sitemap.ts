import type { MetadataRoute } from "next";
import { SITEMAP_MARKETING_ROUTES } from "@/lib/marketing-routes";
import { getAppBaseUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getAppBaseUrl();
  const lastModified = new Date();

  return SITEMAP_MARKETING_ROUTES.map((route) => ({
    url: `${base}${route.href}`,
    lastModified,
    changeFrequency: route.href === "/" ? "weekly" : "monthly",
    priority: route.href === "/" ? 1 : 0.7,
  }));
}
