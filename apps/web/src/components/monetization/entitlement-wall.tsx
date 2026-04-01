import Link from 'next/link';
import {
  entitlementReasonMessage,
  type EntitlementState,
  type OrgSubscriptionSnapshot,
} from '@/lib/auth-guard';

function statusLabel(subscription: OrgSubscriptionSnapshot | null | undefined): string {
  if (!subscription) return 'No subscription';
  return `${subscription.plan} plan · ${subscription.status.toLowerCase().replace('_', ' ')}`;
}

export function EntitlementWall({
  title = 'Upgrade required',
  description,
  subscription,
  entitlement,
}: {
  title?: string;
  description?: string;
  subscription: OrgSubscriptionSnapshot | null | undefined;
  entitlement: EntitlementState;
}) {
  return (
    <section
      className="overflow-hidden rounded-3xl border border-brand-200 bg-gradient-to-br from-white via-brand-50/60 to-amber-50/60 shadow-sm"
      aria-labelledby="upgrade-required-title"
    >
      <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)] lg:p-8">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
            Premium workspace
          </p>
          <div className="space-y-2">
            <h1
              id="upgrade-required-title"
              className="text-2xl font-semibold tracking-tight text-slate-950"
            >
              {title}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-700">
              {description ?? entitlementReasonMessage(entitlement)}
            </p>
          </div>
          <div
            className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
            aria-label={`Current entitlement state: ${statusLabel(subscription)}`}
          >
            {statusLabel(subscription)}
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/settings/billing"
              className="btn-primary min-h-[44px] px-5 py-3"
            >
              View plans and upgrade
            </Link>
            <Link
              href="/"
              className="btn-secondary min-h-[44px] px-5 py-3"
            >
              Return to public scan
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/90 p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            What stays available
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>Free public scan and report link generation</li>
            <li>Plan comparison, billing, and subscription recovery</li>
            <li>Login, signup, and account session management</li>
          </ul>
          <h2 className="mt-5 text-sm font-semibold text-slate-900">
            What is locked
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>Private dashboards, findings, exports, automation, and saved history</li>
            <li>Operator tools, remediation workflows, and collaboration surfaces</li>
            <li>Any org-scoped data fetch or action that would expose premium results</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
