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
      <div className="mx-auto max-w-3xl px-6 py-section-md">
        <p className="text-sm font-medium text-brand-700">Documentation</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          API and integrations
        </h1>
        <p className="mt-4 text-slate-600">
          This product exposes integration through authenticated workspace
          features and CLI/MCP tooling—not a broad anonymous public API.
        </p>

        <ul className="mt-8 space-y-6 text-slate-700">
          <li>
            <h2 className="font-semibold text-slate-900">MCP server</h2>
            <p className="mt-1 text-sm">
              Run{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">
                npx @aros/mcp-server
              </code>{" "}
              for tool-based access. Use this when you need stable workflows in
              IDEs/agents without manually wiring HTTP calls.
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
              Create and rotate keys under Settings → API keys after sign-in.
              Keys are organization-scoped and plan-gated on the server.
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
              <li>Use separate keys per integration and environment.</li>
              <li>Rotate keys during offboarding and incident response.</li>
              <li>Revoke unused keys rather than leaving them dormant.</li>
            </ul>
            <Link
              href="/signup"
              className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline"
            >
              Create a workspace
            </Link>
          </li>

          <li>
            <h2 className="font-semibold text-slate-900">Webhooks and CI</h2>
            <p className="mt-1 text-sm">
              Deploy hooks and GitHub Actions integrations are configured in-app
              per site/repository. Endpoint URLs and secrets are not published
              publicly because they are deployment-specific.
            </p>
          </li>

          <li>
            <h2 className="font-semibold text-slate-900">Error behavior</h2>
            <p className="mt-1 text-sm">
              API routes use explicit status codes for auth failures,
              entitlement gating, and rate limits (for example, 401/403/429)
              instead of silent degradation. Validate downstream integrations
              against non-200 flows before launch.
            </p>
          </li>
        </ul>

        <p className="mt-10 text-sm text-slate-500">
          A standalone public OpenAPI browser is not part of this build. If you
          need machine-readable contracts, use the MCP package source or request
          a deployment-specific export from your operator. See also{" "}
          <Link href="/docs/getting-started" className="font-medium text-brand-700 hover:underline">
            Getting started
          </Link>{" "}
          and{" "}
          <Link href="/docs/plans-and-limits" className="font-medium text-brand-700 hover:underline">
            Plans and limits
          </Link>
          .
        </p>
      </div>
    </MarketingSiteChrome>
  );
}
