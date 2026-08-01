"use server";

import { redirect } from "next/navigation";
import { requireAuthenticatedSession } from "@/lib/session";
import { getAppBaseUrl, getStripePriceIdForPlan } from "@/lib/billing";
import { requireOrgAccess } from "@/lib/auth-guard";
import {
  getBillingCustomer,
  getOrCreateBillingCustomer,
} from "@/lib/billing/org-scoped-queries";
import {
  getBillingCustomerByOrg,
  grantDevCredits,
} from "@/lib/credits/org-scoped-queries";
import { CREDIT_PACKS, type CreditPackId } from "@/lib/credits/packs";
import type { PlanTier } from "@aros/db";
import { logProductEvent, PRODUCT_EVENT_ACTIONS } from "@/lib/product-events";

function redirectWithError(message: string): never {
  redirect(`/settings/billing?error=${encodeURIComponent(message)}`);
}

export async function startSubscriptionCheckoutAction(formData: FormData) {
  const user = await requireAuthenticatedSession();
  const organizationId =
    (formData.get("organizationId") as string | null) ?? "";
  const requestedPlanRaw = (formData.get("plan") as string | null) ?? "";

  const validPlans: PlanTier[] = ["STARTER", "PROFESSIONAL", "ENTERPRISE"];
  if (!validPlans.includes(requestedPlanRaw as PlanTier)) {
    redirectWithError("Select a valid paid plan.");
  }

  const requestedPlan = requestedPlanRaw as
    | "STARTER"
    | "PROFESSIONAL"
    | "ENTERPRISE";

  const ctx = await requireOrgAccess(organizationId, "org:billing");
  const priceId = getStripePriceIdForPlan(requestedPlan);
  if (!priceId || !process.env.STRIPE_SECRET_KEY) {
    redirectWithError("Billing is not configured for this deployment.");
  }

  if (
    ctx.subscription?.plan === requestedPlan &&
    ctx.subscription.status === "ACTIVE"
  ) {
    redirect("/settings/billing?status=already_on_plan");
  }

  let StripeCtor: any;
  try {
    StripeCtor = (await import("stripe")).default;
  } catch {
    redirectWithError("The Stripe SDK is not installed on this deployment.");
  }

  const stripe = new StripeCtor(process.env.STRIPE_SECRET_KEY);
  const baseUrl = getAppBaseUrl();

  const billingCustomer = await getOrCreateBillingCustomer(ctx, {
    createStripeCustomerId: async () => {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name ?? undefined,
        metadata: {
          organizationId: ctx.organizationId,
          userId: user.id,
        },
      });
      return customer.id;
    },
  });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: billingCustomer.stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    subscription_data: {
      metadata: {
        organizationId: ctx.organizationId,
        requestedPlan,
      },
    },
    metadata: {
      organizationId: ctx.organizationId,
      requestedPlan,
      userId: user.id,
    },
    success_url: `${baseUrl}/settings/billing?checkout=success`,
    cancel_url: `${baseUrl}/settings/billing?checkout=cancelled`,
  });

  if (!session.url) {
    redirectWithError("Stripe did not return a checkout URL.");
  }

  await logProductEvent({
    organizationId: ctx.organizationId,
    userId: user.id,
    action: PRODUCT_EVENT_ACTIONS.checkout_started,
    metadata: { plan: requestedPlan },
  });

  redirect(session.url);
}

export async function openBillingPortalAction(formData: FormData) {
  const organizationId =
    (formData.get("organizationId") as string | null) ?? "";
  const ctx = await requireOrgAccess(organizationId, "org:billing");

  if (!process.env.STRIPE_SECRET_KEY) {
    redirectWithError("Billing is not configured for this deployment.");
  }

  const billingCustomer = await getBillingCustomer(ctx);

  if (!billingCustomer) {
    redirect("/settings/billing?status=no_customer");
  }

  let StripeCtor: any;
  try {
    StripeCtor = (await import("stripe")).default;
  } catch {
    redirectWithError("The Stripe SDK is not installed on this deployment.");
  }

  const stripe = new StripeCtor(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.billingPortal.sessions.create({
    customer: billingCustomer!.stripeCustomerId,
    return_url: `${getAppBaseUrl()}/settings/billing`,
  });

  redirect(session.url);
}

export async function purchaseFixCreditsAction(formData: FormData) {
  const user = await requireAuthenticatedSession();
  const organizationId =
    (formData.get("organizationId") as string | null) ?? "";
  const packId = ((formData.get("pack") as string | null) ?? "") as CreditPackId;

  if (!organizationId) {
    redirectWithError("Organization is required.");
  }

  if (!Object.prototype.hasOwnProperty.call(CREDIT_PACKS, packId)) {
    redirectWithError("Select a valid fix credit pack.");
  }

  const ctx = await requireOrgAccess(organizationId, "org:billing");
  const pack = CREDIT_PACKS[packId];
  const billingCustomer = await getBillingCustomerByOrg(ctx);
  if (!billingCustomer) {
    redirectWithError(
      "No billing customer exists yet. Start a subscription checkout first.",
    );
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (stripeSecret) {
    let StripeCtor: any;
    try {
      StripeCtor = (await import("stripe")).default;
    } catch {
      StripeCtor = null;
    }

    if (StripeCtor) {
      const stripe = new StripeCtor(stripeSecret);
      const session = await stripe.checkout.sessions.create({
        customer: billingCustomer.stripeCustomerId,
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `AROS Fix Credits — ${pack.label}`,
                description: `${pack.credits} fix credits for accessibility remediation`,
              },
              unit_amount: pack.priceCents,
            },
            quantity: 1,
          },
        ],
        metadata: {
          organizationId: ctx.organizationId,
          creditPack: packId,
          creditAmount: String(pack.credits),
        },
        success_url: `${getAppBaseUrl()}/settings/billing?credits=success`,
        cancel_url: `${getAppBaseUrl()}/settings/billing?credits=cancelled`,
      });

      if (!session.url) {
        redirectWithError("Stripe did not return a checkout URL for credits.");
      }

      await logProductEvent({
        organizationId: ctx.organizationId,
        userId: user.id,
        action: PRODUCT_EVENT_ACTIONS.fix_credits_checkout_started,
        metadata: { pack: packId, credits: pack.credits, mode: "stripe" },
      });

      redirect(session.url);
    }
  }

  await grantDevCredits(ctx, {
    credits: pack.credits,
    label: pack.label,
  });

  await logProductEvent({
    organizationId: ctx.organizationId,
    userId: user.id,
    action: PRODUCT_EVENT_ACTIONS.fix_credits_checkout_started,
    metadata: { pack: packId, credits: pack.credits, mode: "dev_grant" },
  });

  redirect(`/settings/billing?credits=granted&pack=${packId}`);
}
