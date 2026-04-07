import type { Route } from "next";

/** Public status page — assert until `next build` refreshes generated Route union in CI. */
const STATUS_ROUTE = "/status" as Route;

export type MarketingRoute = {
  href: Route;
  label: string;
  includeInPrimaryNav?: boolean;
  includeInFooter?: boolean;
  includeInSitemap?: boolean;
};

export const MARKETING_ROUTES: readonly MarketingRoute[] = [
  {
    href: "/",
    label: "Home",
    includeInFooter: true,
    includeInSitemap: true,
  },
  {
    href: "/docs",
    label: "Docs",
    includeInPrimaryNav: true,
    includeInFooter: true,
    includeInSitemap: true,
  },
  {
    href: "/docs/getting-started",
    label: "Getting started",
    includeInSitemap: true,
  },
  {
    href: "/docs/plans-and-limits",
    label: "Plans & limits",
    includeInSitemap: true,
  },
  {
    href: "/docs/comparison",
    label: "How we compare",
    includeInSitemap: true,
  },
  {
    href: "/docs/api",
    label: "API & integrations",
    includeInPrimaryNav: true,
    includeInSitemap: true,
  },
  {
    href: "/trust",
    label: "Trust",
    includeInPrimaryNav: true,
    includeInFooter: true,
    includeInSitemap: true,
  },
  {
    href: "/security",
    label: "Security",
    includeInFooter: true,
    includeInSitemap: true,
  },
  {
    href: "/privacy",
    label: "Privacy",
    includeInFooter: true,
    includeInSitemap: true,
  },
  {
    href: "/support",
    label: "Support",
    includeInPrimaryNav: true,
    includeInFooter: true,
    includeInSitemap: true,
  },
  {
    href: STATUS_ROUTE,
    label: "Status",
    includeInFooter: true,
    includeInSitemap: true,
  },
  {
    href: "/accessibility",
    label: "Accessibility",
    includeInSitemap: true,
  },
  {
    href: "/legal/terms",
    label: "Terms",
    includeInFooter: true,
    includeInSitemap: true,
  },
  {
    href: "/legal/subprocessors",
    label: "Subprocessors",
    includeInSitemap: true,
  },
] as const;

export const PRIMARY_MARKETING_NAV = MARKETING_ROUTES.filter(
  (route) => route.includeInPrimaryNav,
);

export const FOOTER_MARKETING_NAV = MARKETING_ROUTES.filter(
  (route) => route.includeInFooter,
);

export const SITEMAP_MARKETING_ROUTES = MARKETING_ROUTES.filter(
  (route) => route.includeInSitemap,
);
