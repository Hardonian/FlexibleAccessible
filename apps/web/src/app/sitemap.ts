import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getAppBaseUrl();
  const lastModified = new Date();

  const paths = [
    "",
    "/docs/api",
    "/login",
    "/signup",
    "/trust",
    "/security",
  ] as const;

  return paths.map((path) => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
