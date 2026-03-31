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
  const title = reason === "disabled" ? "Unlock AI Remediation" : reason === "tier_limit" ? "Upgrade for AI Features" : "AI Quota Exceeded";
  const description = reason === "disabled" 
    ? "Automate your accessibility fixes with GPT-4o powered suggestions. Reduce human labor by up to 90%."
    : reason === "tier_limit"
    ? "Your current tier does not support automated AI suggestions. Upgrade to Professional to unlock high-margin remediation speed."
    : "You've reached your monthly AI token limit. Upgrade to a higher tier to keep printing money with automated fixes.";

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
              href="/settings/billing" 
              className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-all shadow-md shadow-brand-100"
            >
              Upgrade to Professional
            </Link>
            <Link 
              href="/remediation" 
              className="bg-white border border-slate-200 text-slate-700 px-5 py-2 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-all"
            >
              View Usage Stats
            </Link>
          </div>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t border-brand-100 flex items-center gap-2 text-xs text-brand-700 font-medium">
        <LucideShieldAlert size={14} />
        <span>Enterprise plans include custom token quotas and SLA-backed worker density.</span>
      </div>
    </div>
  );
}
