import { createHmac, timingSafeEqual } from 'crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

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

  const planMap: Record<
    string,
    { plan: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'; maxDomains: number; maxPages: number; maxScans: number; maxSeats: number }
  > = {
    [env.priceStarter]: { plan: 'STARTER', maxDomains: 3, maxPages: 200, maxScans: 10, maxSeats: 3 },
    [env.priceProfessional]: { plan: 'PROFESSIONAL', maxDomains: 10, maxPages: 1000, maxScans: 50, maxSeats: 10 },
    [env.priceEnterprise]: { plan: 'ENTERPRISE', maxDomains: 100, maxPages: 10000, maxScans: 500, maxSeats: 100 },
  };

  const priceId = subscription.items?.data?.[0]?.price?.id;
  const planConfig = priceId ? planMap[priceId] : null;

  const statusMap: Record<string, 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIALING'> = {
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELLED',
    trialing: 'TRIALING',
  };

  await tx.subscription.upsert({
    where: { organizationId: billingCustomer.organizationId },
    create: {
      organizationId: billingCustomer.organizationId,
      stripeSubscriptionId: subscription.id,
      plan: planConfig?.plan ?? 'STARTER',
      status: statusMap[subscription.status] ?? 'ACTIVE',
      maxDomains: planConfig?.maxDomains ?? 3,
      maxPagesPerCrawl: planConfig?.maxPages ?? 200,
      maxScansPerMonth: planConfig?.maxScans ?? 10,
      maxSeats: planConfig?.maxSeats ?? 3,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    },
    update: {
      stripeSubscriptionId: subscription.id,
      plan: planConfig?.plan ?? undefined,
      status: statusMap[subscription.status] ?? 'ACTIVE',
      maxDomains: planConfig?.maxDomains,
      maxPagesPerCrawl: planConfig?.maxPages,
      maxScansPerMonth: planConfig?.maxScans,
      maxSeats: planConfig?.maxSeats,
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
      maxDomains: 1,
      maxPagesPerCrawl: 50,
      maxScansPerMonth: 3,
      maxSeats: 1,
    },
  });
}
