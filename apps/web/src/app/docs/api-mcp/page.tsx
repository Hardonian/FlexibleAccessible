import type { Metadata } from "next";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingSurfaceMetadata("API and MCP", "Choosing between session-auth routes, API keys, and MCP tooling.", "/docs/api-mcp");

export default function DocsApiMcpPage() {
  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-3xl px-6 py-section-md space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">API and MCP</h1>
        <p className="text-sm text-slate-700">Use session-auth routes for in-app exports and admin actions. Use org-scoped API keys for integration automation. Use MCP tooling for structured agent workflows.</p>
      </div>
    </MarketingSiteChrome>
  );
}
