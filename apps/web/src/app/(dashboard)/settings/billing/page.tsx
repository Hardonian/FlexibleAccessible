import { requireAuthenticatedSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasPermission } from "@aros/config";
import {
  resolveDashboardOrgMembership,
  runOrgScopedQuery,
} from "@/lib/route-data-boundary";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { EntitlementWall } from "@/components/monetization/entitlement-wall";
import { getBillingPlanCards, isStripeBillingConfigured } from "@/lib/billing";
import { getEntitlementState } from "@/lib/auth-guard";
import {
  openBillingPortalAction,
  purchaseFixCreditsAction,
  startSubscriptionCheckoutAction,
} from "./actions";
import {
  USAGE_METRIC_REPORT_EXPORT,
  USAGE_METRIC_VPAT_EXPORT,
} from "@/lib/usage/report-export-usage";
import { CREDIT_PACK_ORDER, CREDIT_PACKS, type CreditPackId } from "@/lib/credits/packs";

export const metadata = { title: "Billing" };

function noticeFromSearchParams(
  searchParams: Awaited<PageProps["searchParams"]>,
) {
  if (searchParams.checkout === "success") {
    return {
      variant: "info" as const,
      title: "Checkout started",
      message:
        "Stripe checkout completed. We will unlock premium access as soon as the webhook confirms the subscription.",
    };
  }

  if (searchParams.checkout === "cancelled") {
    return {
      variant: "info" as const,
      title: "Checkout cancelled",
      message: "No changes were made to your subscription.",
    };
  }

  if (searchParams.credits === "success") {
    return {
      variant: "info" as const,
      title: "Fix credit checkout complete",
      message:
        "Payment succeeded. Credits are added after Stripe webhook confirmation.",
    };
  }

  if (searchParams.credits === "cancelled") {
    return {
      variant: "info" as const,
      title: "Fix credit checkout cancelled",
      message: "No fix credits were purchased.",
    };
  }

  if (searchParams.credits === "granted") {
    const pack = searchParams.pack && Object.prototype.hasOwnProperty.call(CREDIT_PACKS, searchParams.pack)
      ? CREDIT_PACKS[searchParams.pack as CreditPackId]
      : null;
    return {
      variant: "info" as const,
      title: "Fix credits granted (development mode)",
      message: pack
        ? `${pack.credits} credits were granted because Stripe is not configured in this environment.`
        : "Credits were granted because Stripe is not configured in this environment.",
    };
  }

  if (searchParams.status === "already_on_plan") {
    return {
      variant: "info" as const,
      title: "Already on that plan",
      message: "This organization already has that paid plan active.",
    };
  }

  if (searchParams.status === "upgrade_required") {
    return {
      variant: "info" as const,
      title: "Upgrade required",
      message: searchParams.from
        ? `The private route ${searchParams.from} is only available on a paid plan.`
        : "That private route is only available on a paid plan.",
    };
  }

  if (searchParams.status === "no_customer") {
    return {
      variant: "info" as const,
      title: "Billing customer not ready",
      message:
        "Start a paid checkout first so we can create a billing customer for this organization.",
    };
  }

  if (searchParams.error) {
    return {
      variant: "error" as const,
      title: "Billing action failed",
      message: searchParams.error,
    };
  }

  return null;
}

interface PageProps {
  searchParams: Promise<{
    checkout?: string;
    error?: string;
    status?: string;
    from?: string;
    credits?: string;
    pack?: string;
  }>;
}

export default async function BillingPage({ searchParams }: PageProps) {
  const user = await requireAuthenticatedSession();
  const platformTruth = await getRoutePlatformTruth();
  const params = await searchParams;
  let canViewSystem = false;
  try {
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      select: { role: true },
    });
    canViewSystem = memberships.some((m) =>
      hasPermission(m.role, "org:system:view"),
    );
  } catch (error) {
    // Log error but don't fail the page - assume no system access
    console.warn("[billing page] Failed to check system permissions", {
      userId: user.id,
      error,
    });
  }

  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);
  const notice = noticeFromSearchParams(params);

  if (orgRes.kind !== "ok") {
    return (
      <div className="space-y-6 max-w-5xl">
        <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
        <RouteReliabilityNotice
          variant={orgRes.kind === "platform_blocked" ? "error" : "info"}
          title="Billing requires an organization"
          showSystemLink={canViewSystem}
        >
          <p>
            {orgRes.kind === "platform_blocked"
              ? "The database is not healthy enough to load organization billing."
              : orgRes.kind === "error"
                ? orgRes.message
                : "You need an organization membership before you can manage billing."}
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const billingResult = await runOrgScopedQuery(
    orgRes,
    async (organizationId) => {
      const periodStart = new Date();
      periodStart.setUTCDate(1);
      periodStart.setUTCHours(0, 0, 0, 0);
      const periodEnd = new Date(
        Date.UTC(
          periodStart.getUTCFullYear(),
          periodStart.getUTCMonth() + 1,
          1,
          0,
          0,
          0,
          0,
        ),
      );
      const [membership, customer, scansUsedThisMonth, memberCount, pendingInviteCount, creditLedger, recentCreditTransactions] =
        await Promise.all([
        prisma.membership.findUnique({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId,
            },
          },
          include: {
            organization: {
              include: {
                subscription: true,
              },
            },
          },
        }),
        prisma.billingCustomer.findUnique({
          where: { organizationId },
        }),
        prisma.scanRun.count({
          where: {
            site: {
              workspace: { organizationId },
            },
            createdAt: {
              gte: periodStart,
              lt: periodEnd,
            },
          },
        }),
        prisma.membership.count({ where: { organizationId } }),
        prisma.auditLog.count({
          where: { organizationId, action: "member:invite_pending" },
        }),
        prisma.fixCreditBalance.findUnique({
          where: { organizationId },
        }),
        prisma.fixCredit.findMany({
          where: { organizationId },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            type: true,
            amount: true,
            description: true,
            expiresAt: true,
            createdAt: true,
          },
        }),
      ]);

      const sub = membership?.organization.subscription;
      let exportEventsThisPeriod = 0;
      if (sub?.id && sub.currentPeriodStart && sub.currentPeriodEnd) {
        const agg = await prisma.usageRecord.aggregate({
          where: {
            subscriptionId: sub.id,
            metric: {
              in: [USAGE_METRIC_REPORT_EXPORT, USAGE_METRIC_VPAT_EXPORT],
            },
            periodStart: sub.currentPeriodStart,
            periodEnd: sub.currentPeriodEnd,
          },
          _sum: { quantity: true },
        });
        exportEventsThisPeriod = agg._sum.quantity ?? 0;
      }

      return {
        membership,
        customer,
        scansUsedThisMonth,
        memberCount,
        pendingInviteCount,
        creditLedger,
        recentCreditTransactions,
        exportEventsThisPeriod,
      };
    },
  );

  if (!billingResult.ok || !billingResult.data.membership) {
    return (
      <div className="space-y-6 max-w-5xl">
        <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Billing data unavailable"
          showSystemLink={canViewSystem}
        >
          <p>
            {billingResult.ok
              ? "Organization billing data could not be loaded."
              : billingResult.message}
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const membership = billingResult.data.membership;
  const subscription = membership.organization.subscription;
  const entitlement = getEntitlementState(subscription);
  const stripeReady = isStripeBillingConfigured();
  const canManageBilling = hasPermission(membership.role, "org:billing");
  const plans = getBillingPlanCards();
  const scansUsedThisMonth = billingResult.data.scansUsedThisMonth;
  const memberCount = billingResult.data.memberCount;
  const pendingInviteCount = billingResult.data.pendingInviteCount;
  const seatLimit = subscription?.maxSeats ?? 1;
  const seatsReserved = memberCount + pendingInviteCount;
  const scanLimit = subscription?.maxScansPerMonth ?? 3;
  const scansRemaining = Math.max(scanLimit - scansUsedThisMonth, 0);
  const usagePercent = Math.min(
    100,
    Math.round((scansUsedThisMonth / Math.max(scanLimit, 1)) * 100),
  );
  const exportEventsThisPeriod = billingResult.data.exportEventsThisPeriod ?? 0;
  const creditLedger = billingResult.data.creditLedger;
  const creditBalance = creditLedger?.balance ?? 0;
  const creditsPurchased = creditLedger?.totalPurchased ?? 0;
  const creditsSpent = creditLedger?.totalSpent ?? 0;
  const creditsRefunded = creditLedger?.totalRefunded ?? 0;
  const recentCreditTransactions = billingResult.data.recentCreditTransactions ?? [];

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
          Billing and access
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Billing for {membership.organization.name}
        </h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Premium access is enforced server-side. Upgrade here to unlock the
          private dashboard, exports, automation, operator tools, and saved
          organization history.
        </p>
      </div>

      {notice && (
        <RouteReliabilityNotice variant={notice.variant} title={notice.title}>
          <p>{notice.message}</p>
        </RouteReliabilityNotice>
      )}

      {!stripeReady && (
        <RouteReliabilityNotice
          variant="warning"
          title="Stripe is not configured"
        >
          <p>
            This deployment can show billing status, but checkout and portal
            handoff stay disabled until Stripe environment variables are
            configured on the server.
          </p>
        </RouteReliabilityNotice>
      )}

      {!entitlement.hasPaidAccess && (
        <EntitlementWall
          subscription={subscription}
          entitlement={entitlement}
          title="Premium access is currently locked"
          description="This organization can still use the free public scan, but private dashboard data and premium actions stay blocked until billing is active."
        />
      )}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(22rem,1fr)]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Current subscription
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Status, limits, and plan-level entitlement for this
                organization.
              </p>
            </div>
            {canManageBilling && (
              <form action={openBillingPortalAction}>
                <input
                  type="hidden"
                  name="organizationId"
                  value={membership.organizationId}
                />
                <button
                  type="submit"
                  className="btn-secondary min-h-[44px] px-4"
                  disabled={!stripeReady || !billingResult.data.customer}
                >
                  Manage billing in Stripe
                </button>
              </form>
            )}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Plan" value={subscription?.plan ?? "FREE"} />
            <Stat
              label="Status"
              value={(subscription?.status ?? "ACTIVE")
                .toLowerCase()
                .replace("_", " ")}
            />
            <Stat
              label="Domains"
              value={String(subscription?.maxDomains ?? 1)}
            />
            <Stat
              label="Pages / crawl"
              value={String(subscription?.maxPagesPerCrawl ?? 50)}
            />
            <Stat
              label="AI access"
              value={subscription?.aiEnabled ? "Included" : "Locked"}
            />
          </div>

          <div
            className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600"
            role="status"
          >
            <p className="font-medium text-slate-900">Seats</p>
            <p className="mt-1">
              {memberCount} member{memberCount === 1 ? "" : "s"}
              {pendingInviteCount > 0
                ? `, ${pendingInviteCount} pending invite${pendingInviteCount === 1 ? "" : "s"}`
                : ""}{" "}
              · cap {seatLimit}
              {seatsReserved >= seatLimit ? (
                <span className="text-amber-800">
                  {" "}
                  (at seat cap — upgrade or remove pending invites to add people)
                </span>
              ) : null}
            </p>
          </div>

          <div
            className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"
            role="status"
            aria-label="Billing customer status"
          >
            <p>
              Current billing customer:{" "}
              <span className="font-medium text-slate-900">
                {billingResult.data.customer ? "Connected" : "Not created yet"}
              </span>
            </p>
            {subscription?.currentPeriodEnd && (
              <p className="mt-2">
                Current period ends on{" "}
                <span className="font-medium text-slate-900">
                  {subscription.currentPeriodEnd.toLocaleDateString()}
                </span>
                .
              </p>
            )}
            {subscription?.cancelAtPeriodEnd && (
              <p className="mt-2 text-amber-800">
                This subscription is set to cancel at period end.
              </p>
            )}
            {entitlement.reason === "past_due" && (
              <p className="mt-2 text-amber-900">
                Past due: private dashboard routes stay locked until billing is current. You can still use this billing
                page and the public scan.
              </p>
            )}
            {entitlement.reason === "cancelled" && (
              <p className="mt-2 text-amber-900">
                Cancelled: you keep read access to billing here; private product data stays locked until you subscribe
                again.
              </p>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Downgrade to Free (via Stripe or support) resets limits to the Free tier and removes paid automation such
              as deploy webhooks (Professional+) and AI draft assist (Professional+ with AI enabled).
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-900">
                Verification scan usage
              </p>
              <p className="text-xs text-slate-600">
                {scansUsedThisMonth}/{scanLimit} this month
              </p>
            </div>
            <div
              className="mt-2 h-2 rounded-full bg-slate-200"
              role="progressbar"
              aria-label="Monthly verification scan usage"
              aria-valuemin={0}
              aria-valuemax={scanLimit}
              aria-valuenow={Math.min(scansUsedThisMonth, scanLimit)}
            >
              <div
                className="h-2 rounded-full bg-brand-600"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-600">
              {scansRemaining > 0
                ? `${scansRemaining} scans remaining in this billing month.`
                : "You have reached this month’s scan limit. Upgrade to keep running private verification scans."}
            </p>
          </div>

          {subscription?.currentPeriodStart && subscription?.currentPeriodEnd && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-900">
                Evidence export events (this Stripe period)
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-950 tabular-nums">
                {exportEventsThisPeriod}
              </p>
              <p className="mt-2 text-xs text-slate-600">
                Counts successful downloads of findings reports and VPAT exports (
                <code className="rounded bg-slate-100 px-1 text-[10px]">
                  {USAGE_METRIC_REPORT_EXPORT}
                </code>
                ,{" "}
                <code className="rounded bg-slate-100 px-1 text-[10px]">
                  {USAGE_METRIC_VPAT_EXPORT}
                </code>
                ). For margin and pricing, aggregate here—not a hard cap in this build.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-950 p-6 text-slate-50 shadow-sm">
          <h2 className="text-lg font-semibold">Access model</h2>
          <p className="mt-2 text-sm text-slate-300">
            Public scan stays free. Every private org surface is protected at
            the route, action, and API level.
          </p>
          <ul className="mt-5 space-y-3 text-sm text-slate-300">
            <li>Free: marketing pages and public scan results.</li>
            <li>
              Paid: dashboard, findings, reports, exports, reviews, remediation,
              and automations.
            </li>
            <li>
              Billing managers can recover or upgrade even when premium access
              is currently blocked.
            </li>
          </ul>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-950">
            Choose a plan
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Prices are monthly. Upgrade flow opens Stripe Checkout and
            entitlement sync happens via webhook.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-4">
          {plans.map((plan) => {
            const isCurrent = subscription?.plan === plan.tier;
            const isSelectable = canManageBilling && plan.isPaid;

            return (
              <article
                aria-label={`${plan.name} plan, ${plan.priceMonthly === 0 ? "free" : `$${plan.priceMonthly} per month`}${isCurrent ? ", current plan" : ""}`}
                key={plan.tier}
                className={`rounded-3xl border bg-white p-5 shadow-sm ${
                  plan.tier === "PROFESSIONAL"
                    ? "border-brand-300 ring-2 ring-brand-100"
                    : "border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-slate-950">
                    {plan.name}
                  </h3>
                  {isCurrent && (
                    <span className="rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-700">
                      Current
                    </span>
                  )}
                </div>
                <p className="mt-4 text-3xl font-semibold text-slate-950">
                  ${plan.priceMonthly}
                  <span className="ml-1 text-sm font-normal text-slate-500">
                    /mo
                  </span>
                </p>
                <ul className="mt-5 space-y-2 text-sm text-slate-600">
                  <li>{plan.maxDomains} domains</li>
                  <li>{plan.maxPagesPerCrawl} pages per crawl</li>
                  <li>{plan.maxScansPerMonth} scans per month</li>
                  <li>{plan.maxSeats} seats</li>
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <div className="mt-6">
                  {plan.isPaid ? (
                    <form action={startSubscriptionCheckoutAction}>
                      <input
                        type="hidden"
                        name="organizationId"
                        value={membership.organizationId}
                      />
                      <input type="hidden" name="plan" value={plan.tier} />
                      <button
                        type="submit"
                        className={
                          plan.tier === "PROFESSIONAL"
                            ? "btn-primary w-full min-h-[44px]"
                            : "btn-secondary w-full min-h-[44px]"
                        }
                        disabled={!isSelectable || !stripeReady}
                      >
                        {isCurrent ? "Current plan" : `Upgrade to ${plan.name}`}
                      </button>
                    </form>
                  ) : (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-sm text-slate-600">
                      Free public scan only
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-slate-950">Fix credits</h2>
          <p className="text-sm text-slate-600">
            Credits are consumed by assisted remediation actions. Purchase is
            enforced server-side and tied to this organization billing customer.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Current balance" value={String(creditBalance)} />
          <Stat label="Purchased" value={String(creditsPurchased)} />
          <Stat label="Spent" value={String(creditsSpent)} />
          <Stat label="Refunded" value={String(creditsRefunded)} />
        </div>
        <p className="text-xs text-slate-500">
          {stripeReady
            ? "Production behavior: checkout opens Stripe and credits are applied by webhook."
            : "Development behavior: Stripe is unavailable, so purchases grant credits immediately for testing."}
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {CREDIT_PACK_ORDER.map((packId) => {
            const pack = CREDIT_PACKS[packId];
            return (
              <form key={packId} action={purchaseFixCreditsAction} className="rounded-2xl border border-slate-200 p-4">
                <input type="hidden" name="organizationId" value={membership.organizationId} />
                <input type="hidden" name="pack" value={packId} />
                <p className="text-sm font-medium text-slate-900">{pack.label}</p>
                <p className="mt-1 text-xs text-slate-600">${(pack.priceCents / 100).toFixed(2)} one-time</p>
                <button type="submit" className="btn-secondary mt-3 w-full min-h-[44px]" disabled={!canManageBilling}>
                  Buy {pack.credits} credits
                </button>
              </form>
            );
          })}
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium">Expiry</th>
              </tr>
            </thead>
            <tbody>
              {recentCreditTransactions.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-slate-500" colSpan={5}>
                    No credit transactions yet.
                  </td>
                </tr>
              ) : (
                recentCreditTransactions.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-slate-700">
                      {entry.createdAt.toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{entry.type}</td>
                    <td className="px-3 py-2 text-slate-700 tabular-nums">
                      {entry.amount > 0 ? "+" : ""}
                      {entry.amount}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{entry.description}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {entry.expiresAt ? entry.expiresAt.toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p
        className="mt-2 text-lg font-semibold text-slate-950"
        aria-label={`${label}: ${value}`}
      >
        {value}
      </p>
    </div>
  );
}
