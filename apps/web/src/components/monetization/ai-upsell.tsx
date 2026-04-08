import Link from "next/link";
import { LucideShieldAlert, LucideZap } from "lucide-react";

interface AiUpsellProps {
  reason: "disabled" | "quota_exceeded" | "tier_limit";
}

/**
 * High-conversion upsell component for AI features.
 * Perfection means never hitting a dead end — always a path to more value.
 */
export function AiUpsell({ reason }: AiUpsellProps) {
  const title =
    reason === "disabled"
      ? "Unlock AI remediation"
      : reason === "tier_limit"
        ? "Upgrade for AI features"
        : "AI quota exceeded";
  const description =
    reason === "disabled"
      ? "Automate accessibility remediation with server-enforced premium AI suggestions, review workflows, and export-ready fixes."
      : reason === "tier_limit"
        ? "Your current plan does not include AI remediation. Upgrade to a paid tier to unlock premium suggestions and exports."
        : "You have reached the AI quota for this billing period. Move to a higher plan or update billing to restore access.";

  return (
    <div className="rounded-2xl border-2 border-brand-200 bg-brand-50 p-6 shadow-sm overflow-hidden relative">
      {/* Decorative pulse background */}
      <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-brand-100 rounded-full blur-3xl opacity-50" />
      
      <div className="flex gap-4 items-start relative z-10">
        <div className="p-3 bg-brand-600 rounded-xl text-white shadow-lg shadow-brand-200">
          <LucideZap size={24} />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <p className="text-slate-600 mt-1 text-sm max-w-md">
            {description}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={"/settings/billing" as any}
              className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-brand-100 transition-all hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
            >
              View plans and upgrade
            </Link>
          </div>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-brand-100 flex items-center gap-2 text-xs text-brand-700 font-medium">
        <LucideShieldAlert size={14} />
        <span>Premium AI access stays locked until the organization has an active paid subscription.</span>
      </div>
    </div>
  );
}
