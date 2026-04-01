'use server';

import { redirect } from 'next/navigation';
import { requireOrgAccess } from '@/lib/auth-guard';
import { prisma } from '@/lib/db';
import {
  getAppBaseUrl,
  getStripePriceIdForPlan,
} from '@/lib/billing';

function redirectWithError(message: string) {
  redirect(`/settings/billing?error=${encodeURIComponent(message)}`);
}

export async function startSubscriptionCheckoutAction(formData: FormData) {
  const organizationId = (formData.get('organizationId') as string | null) ?? '';
  const requestedPlan = (formData.get('plan') as string | null) ?? '';

  if (
    requestedPlan !== 'STARTER' &&
    requestedPlan !== 'PROFESSIONAL' &&
    requestedPlan !== 'ENTERPRISE'
  ) {
    redirectWithError('Select a valid paid plan.');
  }

  const ctx = await requireOrgAccess(organizationId, 'org:billing');
  const priceId = getStripePriceIdForPlan(requestedPlan);
  if (!priceId || !process.env.STRIPE_SECRET_KEY) {
    redirectWithError('Billing is not configured for this deployment.');
  }

  if (ctx.subscription?.plan === requestedPlan && ctx.subscription.status === 'ACTIVE') {
    redirect('/settings/billing?status=already_on_plan');
  }

  let StripeCtor: any;
  try {
    StripeCtor = (await import('stripe')).default;
  } catch {
    redirectWithError('The Stripe SDK is not installed on this deployment.');
  }

  const stripe = new StripeCtor(process.env.STRIPE_SECRET_KEY);
  const baseUrl = getAppBaseUrl();

  let billingCustomer = await prisma.billingCustomer.findUnique({
    where: { organizationId: ctx.organizationId },
  });

  if (!billingCustomer) {
    const customer = await stripe.customers.create({
      email: ctx.user.email,
      name: ctx.user.name ?? undefined,
      metadata: {
        organizationId: ctx.organizationId,
        userId: ctx.user.id,
      },
    });

    billingCustomer = await prisma.billingCustomer.create({
      data: {
        organizationId: ctx.organizationId,
        stripeCustomerId: customer.id,
      },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
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
      userId: ctx.user.id,
    },
    success_url: `${baseUrl}/settings/billing?checkout=success`,
    cancel_url: `${baseUrl}/settings/billing?checkout=cancelled`,
  });

  if (!session.url) {
    redirectWithError('Stripe did not return a checkout URL.');
  }

  redirect(session.url);
}

export async function openBillingPortalAction(formData: FormData) {
  const organizationId = (formData.get('organizationId') as string | null) ?? '';
  const ctx = await requireOrgAccess(organizationId, 'org:billing');

  if (!process.env.STRIPE_SECRET_KEY) {
    redirectWithError('Billing is not configured for this deployment.');
  }

  const billingCustomer = await prisma.billingCustomer.findUnique({
    where: { organizationId: ctx.organizationId },
  });

  if (!billingCustomer) {
    redirect('/settings/billing?status=no_customer');
  }

  let StripeCtor: any;
  try {
    StripeCtor = (await import('stripe')).default;
  } catch {
    redirectWithError('The Stripe SDK is not installed on this deployment.');
  }

  const stripe = new StripeCtor(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.billingPortal.sessions.create({
    customer: billingCustomer!.stripeCustomerId,
    return_url: `${getAppBaseUrl()}/settings/billing`,
  });

  redirect(session.url);
}
