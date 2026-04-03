import { createHmac, timingSafeEqual } from 'crypto';
import { PLANS, type PlanTier } from '@aros/config';
import type { Prisma, PrismaClient } from '@aros/db';

export interface StripeWebhookEnv {
  webhookSecret: string;
  priceStarter: string;
  priceProfessional: string;
  priceEnterprise: string;
}

export function verifyStripeSignature(payload: string, header: string, secret: string): boolean {
  const parts = header.split(',');
  const timestamp = parts.find((p) => p.startsWith('t='))?.split('=')[1];
  const sig = parts.find((p) => p.startsWith('v1='))?.split('=').slice(1).join('=');

  if (!timestamp || !sig) return false;

  const expectedSig = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  try {
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expectedSig, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Test helper: build a valid Stripe-Signature header value. */
export function signStripePayload(payload: string, secret: string, timestampSec: number = Math.floor(Date.now() / 1000)): string {
  const sig = createHmac('sha256', secret).update(`${timestampSec}.${payload}`).digest('hex');
  return `t=${timestampSec},v1=${sig}`;
}

type StripeSubscriptionObject = {
  id: string;
  customer: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end?: boolean;
  items?: { data?: Array<{ price?: { id?: string } }> };
};

export type StripeWebhookResult =
  | { ok: true; duplicate: false }
  | { ok: true; duplicate: true }
  | { ok: false; status: number; message: string };

/**
 * Verifies signature, parses JSON, and applies subscription updates idempotently by Stripe event id.
 */
export async function handleStripeWebhookRequest(
  rawBody: string,
  signatureHeader: string | null,
  env: StripeWebhookEnv,
  prisma: PrismaClient
): Promise<StripeWebhookResult> {
  if (!signatureHeader) {
    return { ok: false, status: 400, message: 'Missing signature' };
  }

  if (!verifyStripeSignature(rawBody, signatureHeader, env.webhookSecret)) {
    return { ok: false, status: 400, message: 'Invalid signature' };
  }

  let event: { id?: string; type?: string; data?: { object?: unknown } };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return { ok: false, status: 400, message: 'Invalid JSON' };
  }

  const eventId = event.id;
  const eventType = event.type;
  if (!eventId || !eventType) {
    return { ok: false, status: 400, message: 'Invalid event payload' };
  }

  const existing = await prisma.stripeWebhookEvent.findUnique({ where: { id: eventId } });
  if (existing) {
    return { ok: true, duplicate: true };
  }

  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.stripeWebhookEvent.create({
        data: { id: eventId, type: eventType },
      });

      switch (eventType) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await applySubscriptionUpsert(tx, event.data?.object as StripeSubscriptionObject, env);
          break;
        case 'customer.subscription.deleted':
          await applySubscriptionDeleted(tx, event.data?.object as StripeSubscriptionObject);
          break;
        default:
          break;
      }
    });
  } catch (e: unknown) {
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code: string }).code) : '';
    if (code === 'P2002') {
      return { ok: true, duplicate: true };
    }
    console.error('Stripe webhook transaction error:', e);
    return { ok: false, status: 500, message: 'Webhook processing failed' };
  }

  return { ok: true, duplicate: false };
}


function resolvePlanTierFromPriceId(priceId: string | undefined, env: StripeWebhookEnv): Exclude<PlanTier, 'FREE'> | null {
  if (!priceId) return null;
  if (priceId === env.priceStarter) return 'STARTER';
  if (priceId === env.priceProfessional) return 'PROFESSIONAL';
  if (priceId === env.priceEnterprise) return 'ENTERPRISE';
  return null;
}

const statusMap: Record<string, 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIALING'> = {
  active: 'ACTIVE',
  past_due: 'PAST_DUE',
  canceled: 'CANCELLED',
  trialing: 'TRIALING',
};

function subscriptionStatusFromStripe(status: string | undefined): 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIALING' {
  return statusMap[status ?? ''] ?? 'ACTIVE';
}

async function applySubscriptionUpsert(
  tx: Prisma.TransactionClient,
  subscription: StripeSubscriptionObject,
  env: StripeWebhookEnv
) {
  if (!subscription?.customer || !subscription.id) return;

  const customerId = subscription.customer;
  const billingCustomer = await tx.billingCustomer.findUnique({
    where: { stripeCustomerId: customerId },
  });
  if (!billingCustomer) return;

  const priceId = subscription.items?.data?.[0]?.price?.id;
  const resolvedPlanTier = resolvePlanTierFromPriceId(priceId, env);
  const planConfig = resolvedPlanTier ? PLANS[resolvedPlanTier] : null;

  if (!resolvedPlanTier && priceId) {
    console.warn('[stripe-webhook] unknown price id received; preserving existing entitlement where possible', {
      stripeSubscriptionId: subscription.id,
      priceId,
    });
  }

  await tx.subscription.upsert({
    where: { organizationId: billingCustomer.organizationId },
    create: {
      organizationId: billingCustomer.organizationId,
      stripeSubscriptionId: subscription.id,
      plan: planConfig?.tier ?? 'FREE',
      status: subscriptionStatusFromStripe(subscription.status),
      maxDomains: planConfig?.maxDomains ?? PLANS.FREE.maxDomains,
      maxPagesPerCrawl: planConfig?.maxPagesPerCrawl ?? PLANS.FREE.maxPagesPerCrawl,
      maxScansPerMonth: planConfig?.maxScansPerMonth ?? PLANS.FREE.maxScansPerMonth,
      maxSeats: planConfig?.maxSeats ?? PLANS.FREE.maxSeats,
      aiEnabled: planConfig?.aiEnabled ?? PLANS.FREE.aiEnabled,
      aiTokenLimit: planConfig?.aiTokenLimit ?? PLANS.FREE.aiTokenLimit,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    },
    update: {
      stripeSubscriptionId: subscription.id,
      plan: planConfig?.tier ?? undefined,
      status: subscriptionStatusFromStripe(subscription.status),
      maxDomains: planConfig?.maxDomains,
      maxPagesPerCrawl: planConfig?.maxPagesPerCrawl,
      maxScansPerMonth: planConfig?.maxScansPerMonth,
      maxSeats: planConfig?.maxSeats,
      aiEnabled: planConfig?.aiEnabled,
      aiTokenLimit: planConfig?.aiTokenLimit,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    },
  });
}

async function applySubscriptionDeleted(tx: Prisma.TransactionClient, subscription: StripeSubscriptionObject) {
  if (!subscription?.customer) return;
  const billingCustomer = await tx.billingCustomer.findUnique({
    where: { stripeCustomerId: subscription.customer },
  });
  if (!billingCustomer) return;

  await tx.subscription.update({
    where: { organizationId: billingCustomer.organizationId },
    data: {
      status: 'CANCELLED',
      plan: 'FREE',
      maxDomains: PLANS.FREE.maxDomains,
      maxPagesPerCrawl: PLANS.FREE.maxPagesPerCrawl,
      maxScansPerMonth: PLANS.FREE.maxScansPerMonth,
      maxSeats: PLANS.FREE.maxSeats,
      aiEnabled: PLANS.FREE.aiEnabled,
      aiTokenLimit: PLANS.FREE.aiTokenLimit,
    },
  });
}
