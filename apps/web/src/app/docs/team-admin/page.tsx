import type { Metadata } from "next";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { TruthBadge } from "@/components/truth/truth-badge";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingSurfaceMetadata("Team admin", "Member roles, seat usage, pending invites, and staged enterprise controls.", "/docs/team-admin");

export default function DocsTeamAdminPage() {
  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-3xl px-6 py-section-md space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">Team administration</h1>
        <p className="text-sm text-slate-700"><TruthBadge state="implemented" className="mr-2" />Organization members, role changes, seat usage, and pending invite records are available in settings.</p>
        <p className="text-sm text-slate-700"><TruthBadge state="staged" className="mr-2" />SSO/SCIM and automated outbound invite email remain deployment-dependent and staged by operator configuration.</p>
      </div>
    </MarketingSiteChrome>
  );
}
