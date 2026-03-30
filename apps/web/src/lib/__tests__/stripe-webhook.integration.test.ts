import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  handleStripeWebhookRequest,
  signStripePayload,
  verifyStripeSignature,
  type StripeWebhookEnv,
} from '../stripe-webhook';

const prisma = new PrismaClient();

/** Skip integration tests when DATABASE_URL is unset or Postgres is not reachable (e.g. local `npm run verify` without Docker). */
let databaseReachable = false;
if (process.env.DATABASE_URL) {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    databaseReachable = true;
  } catch {
    await prisma.$disconnect().catch(() => {});
  }
}

const env: StripeWebhookEnv = {
  webhookSecret: 'whsec_test_integration_secret_key_32bytes!!',
  priceStarter: 'price_starter_test',
  priceProfessional: 'price_professional_test',
  priceEnterprise: 'price_enterprise_test',
};

function subscriptionPayload(opts: {
  id: string;
  eventId: string;
  customerId: string;
  priceId: string;
  status?: string;
  type?: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: opts.eventId,
    type: opts.type ?? 'customer.subscription.updated',
    data: {
      object: {
        id: opts.id,
        customer: opts.customerId,
        status: opts.status ?? 'active',
        current_period_start: now - 86400,
        current_period_end: now + 86400 * 30,
        cancel_at_period_end: false,
        items: { data: [{ price: { id: opts.priceId } }] },
      },
    },
  };
}

const describeDb = databaseReachable ? describe.sequential : describe.skip;

describeDb('Stripe webhook integration', () => {
  let orgId: string;
  const stripeCustomerId = `cus_test_${Date.now()}`;

  beforeAll(async () => {
    await prisma.stripeWebhookEvent.deleteMany({
      where: { id: { startsWith: 'evt_test_' } },
    });
    const org = await prisma.organization.create({
      data: { name: 'Webhook Test Org', slug: `wh-test-${Date.now()}` },
    });
    orgId = org.id;
    await prisma.billingCustomer.create({
      data: { organizationId: orgId, stripeCustomerId },
    });
    await prisma.subscription.create({
      data: {
        organizationId: orgId,
        plan: 'FREE',
        status: 'ACTIVE',
        maxDomains: 1,
        maxPagesPerCrawl: 50,
        maxScansPerMonth: 3,
        maxSeats: 1,
      },
    });
  });

  afterAll(async () => {
    await prisma.stripeWebhookEvent.deleteMany({ where: { id: { startsWith: 'evt_test_' } } });
    await prisma.billingCustomer.deleteMany({ where: { organizationId: orgId } });
    await prisma.subscription.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.delete({ where: { id: orgId } });
    await prisma.$disconnect();
  });

  it('rejects missing signature', async () => {
    const body = JSON.stringify(subscriptionPayload({ id: 'sub_1', eventId: 'evt_test_missing', customerId: stripeCustomerId, priceId: env.priceStarter }));
    const r = await handleStripeWebhookRequest(body, null, env, prisma);
    expect(r).toEqual({ ok: false, status: 400, message: 'Missing signature' });
  });

  it('rejects invalid signature', async () => {
    const body = JSON.stringify(subscriptionPayload({ id: 'sub_1', eventId: 'evt_test_bad_sig', customerId: stripeCustomerId, priceId: env.priceStarter }));
    const r = await handleStripeWebhookRequest(body, 't=1,v1=deadbeef', env, prisma);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it('upserts subscription on customer.subscription.updated', async () => {
    const eventId = `evt_test_${Date.now()}_a`;
    const subId = `sub_test_${Date.now()}`;
    const payload = subscriptionPayload({
      id: subId,
      eventId,
      customerId: stripeCustomerId,
      priceId: env.priceProfessional,
    });
    const raw = JSON.stringify(payload);
    const sig = signStripePayload(raw, env.webhookSecret);

    const r = await handleStripeWebhookRequest(raw, sig, env, prisma);
    expect(r).toEqual({ ok: true, duplicate: false });

    const sub = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
    expect(sub?.plan).toBe('PROFESSIONAL');
    expect(sub?.stripeSubscriptionId).toBe(subId);
    expect(sub?.maxDomains).toBe(10);
    expect(sub?.maxPagesPerCrawl).toBe(1000);
  });

  it('is idempotent for the same Stripe event id', async () => {
    const eventId = `evt_test_${Date.now()}_b`;
    const subId = `sub_test_dup_${Date.now()}`;
    const payload = subscriptionPayload({
      id: subId,
      eventId,
      customerId: stripeCustomerId,
      priceId: env.priceStarter,
    });
    const raw = JSON.stringify(payload);
    const sig = signStripePayload(raw, env.webhookSecret);

    const first = await handleStripeWebhookRequest(raw, sig, env, prisma);
    expect(first).toEqual({ ok: true, duplicate: false });

    const second = await handleStripeWebhookRequest(raw, sig, env, prisma);
    expect(second).toEqual({ ok: true, duplicate: true });

    const rows = await prisma.stripeWebhookEvent.findMany({ where: { id: eventId } });
    expect(rows).toHaveLength(1);
  });

  it('downgrades on customer.subscription.deleted', async () => {
    const eventId = `evt_test_${Date.now()}_del`;
    const payload = {
      id: eventId,
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_deleted',
          customer: stripeCustomerId,
          status: 'canceled',
          current_period_start: Math.floor(Date.now() / 1000) - 100,
          current_period_end: Math.floor(Date.now() / 1000) + 100,
        },
      },
    };
    const raw = JSON.stringify(payload);
    const sig = signStripePayload(raw, env.webhookSecret);

    const r = await handleStripeWebhookRequest(raw, sig, env, prisma);
    expect(r).toEqual({ ok: true, duplicate: false });

    const sub = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
    expect(sub?.plan).toBe('FREE');
    expect(sub?.status).toBe('CANCELLED');
    expect(sub?.maxDomains).toBe(1);
  });
});

describe('Stripe signature helpers', () => {
  it('verifyStripeSignature accepts signStripePayload output', () => {
    const secret = 'whsec_unit';
    const body = '{"type":"ping"}';
    const header = signStripePayload(body, secret, 1700000000);
    expect(verifyStripeSignature(body, header, secret)).toBe(true);
    expect(verifyStripeSignature(body + 'x', header, secret)).toBe(false);
  });
});
