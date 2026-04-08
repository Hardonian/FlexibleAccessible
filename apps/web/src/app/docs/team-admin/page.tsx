import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { TruthBadge } from "@/components/truth/truth-badge";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingSurfaceMetadata(
  "Team admin",
  "Member roles, seat usage, pending invites, audit trail posture, and staged enterprise controls.",
  "/docs/team-admin",
);

export default function DocsTeamAdminPage() {
  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-3xl px-6 py-section-md space-y-5">
        <h1 className="text-3xl font-bold text-slate-900">Team administration</h1>
        <p className="text-sm text-slate-700">
          This guide reflects current shipped behavior for team-admin workflows in
          AROS, including what is implemented, environment-dependent, or staged.
        </p>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">Current posture</h2>
          <p className="text-sm text-slate-700"><TruthBadge state="implemented" className="mr-2" />Organization members, role changes, seat usage, pending invite records, and org-scoped audit-log export routes are available.</p>
          <p className="text-sm text-slate-700"><TruthBadge state="partial" className="mr-2" />Invites are recorded and seat-checked; outbound invite email remains manual in this deployment.</p>
          <p className="text-sm text-slate-700"><TruthBadge state="environment_dependent" className="mr-2" />OIDC SSO depends on deployment env/operator configuration.</p>
          <p className="text-sm text-slate-700"><TruthBadge state="staged" className="mr-2" />SCIM and directory sync are staged and should not be sold as default capabilities.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">Operator quick links</h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/settings/members" className="btn-secondary text-xs">Members workspace</Link>
            <Link href="/reviews" className="btn-secondary text-xs">Review queue</Link>
            <Link href="/trust" className="btn-secondary text-xs">Trust center</Link>
            <Link href="/docs/reviews-and-manual-verification" className="btn-secondary text-xs">Review operations docs</Link>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-slate-900">Seat and audit guidance</h2>
          <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
            <li>Seat usage is measured as current members + pending invites, with server-side seat-cap enforcement.</li>
            <li>Review and membership actions are intended to be visible through org audit-log exports for buyer and support workflows.</li>
            <li>When enterprise controls are staged, use explicit contract language that reflects deployed configuration.</li>
          </ul>
        </section>
      </div>
    </MarketingSiteChrome>
  );
}
