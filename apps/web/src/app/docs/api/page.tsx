import Link from "next/link";
import type { Metadata } from "next";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { PRODUCT_DISPLAY_NAME } from "@/lib/product-brand";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingSurfaceMetadata(
  "API & integrations",
  `How to integrate ${PRODUCT_DISPLAY_NAME} today: MCP server, org-scoped API keys, and webhooks. This deployment does not ship a separate public OpenAPI browser.`,
  "/docs/api",
);

export default function DocsApiPage() {
  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-2xl px-6 py-section-md">
        <p className="text-sm font-medium text-brand-700">Documentation</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          API and integrations
        </h1>
        <p className="mt-4 text-slate-600">
          This product ships integration through authenticated workspace features,
          not a separate browsable public API reference site. Below is what this
          repository supports today.
        </p>

        <ul className="mt-8 space-y-6 text-slate-700">
          <li>
            <h2 className="font-semibold text-slate-900">MCP server</h2>
            <p className="mt-1 text-sm">
              Run{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">
                npx @aros/mcp-server
              </code>{" "}
              for tool-based access. See the package README on npm for options.
            </p>
            <a
              href="https://www.npmjs.com/package/@aros/mcp-server"
              className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              View @aros/mcp-server on npm
            </a>
          </li>
          <li>
            <h2 className="font-semibold text-slate-900">
              Organization API keys
            </h2>
            <p className="mt-1 text-sm">
              After you sign in, create and rotate keys under Settings → API keys.
              Usage is org-scoped and subject to plan limits enforced on the server.
            </p>
            <Link
              href="/signup"
              className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline"
            >
              Create a workspace
            </Link>
          </li>
          <li>
            <h2 className="font-semibold text-slate-900">Webhooks &amp; CI</h2>
            <p className="mt-1 text-sm">
              Deploy hooks and GitHub Actions integrations are configured in the
              dashboard per site or repository; see in-app settings for the exact
              endpoints and secrets your deployment exposes.
            </p>
          </li>
        </ul>

        <p className="mt-10 text-sm text-slate-500">
          A standalone public OpenAPI browser is not part of this build. If you need
          machine-readable contracts, use the MCP package source or ask your
          operator for an export from this deployment.
        </p>
      </div>
    </MarketingSiteChrome>
  );
}
