import { requireSession } from "@/lib/session";
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
  startSubscriptionCheckoutAction,
} from "./actions";

export const metadata = { title: "Billing - AROS" };

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
  }>;
}

export default async function BillingPage({ searchParams }: PageProps) {
  const user = await requireSession();
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
      const [membership, customer] = await Promise.all([
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
      ]);

      return {
        membership,
        customer,
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
              label="AI access"
              value={subscription?.aiEnabled ? "Included" : "Locked"}
            />
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
          </div>
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
