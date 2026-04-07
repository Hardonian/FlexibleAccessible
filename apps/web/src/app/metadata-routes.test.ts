import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { SITEMAP_MARKETING_ROUTES } from "@/lib/marketing-routes";

describe("marketing metadata routes", () => {
  it("sitemap includes all intended public acquisition and docs routes", () => {
    const map = sitemap();
    const urls = map.map((entry) => new URL(entry.url).pathname);

    expect(urls).toEqual(
      expect.arrayContaining(SITEMAP_MARKETING_ROUTES.map((route) => route.href)),
    );
    expect(urls).not.toEqual(expect.arrayContaining(["/login", "/signup"]));
    expect(urls).not.toEqual(expect.arrayContaining(["/dashboard", "/settings"]));
  });

  it("robots disallows auth, dashboard, settings, and API prefixes", () => {
    const data = robots();
    const rules = Array.isArray(data.rules) ? data.rules[0] : data.rules;
    const disallow = rules?.disallow ?? [];

    expect(disallow).toEqual(
      expect.arrayContaining([
        "/login",
        "/signup",
        "/forgot-password",
        "/dashboard/",
        "/settings/",
        "/api/",
      ]),
    );
  });
});
