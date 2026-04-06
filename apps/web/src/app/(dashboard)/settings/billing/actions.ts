"use server";

import { redirect } from "next/navigation";
import { requireAuthenticatedSession } from "@/lib/session";
import { getAppBaseUrl, getStripePriceIdForPlan } from "@/lib/billing";
import { requireOrgAccess } from "@/lib/auth-guard";
import {
  getBillingCustomer,
  getOrCreateBillingCustomer,
} from "@/lib/billing/org-scoped-queries";
import type { PlanTier } from "@aros/db";
import { logProductEvent, PRODUCT_EVENT_ACTIONS } from "@/lib/product-events";

function redirectWithError(message: string) {
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
