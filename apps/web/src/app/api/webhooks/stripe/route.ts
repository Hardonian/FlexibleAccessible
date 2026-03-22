import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createHmac } from 'crypto';

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  // Verify webhook signature
  if (!verifyStripeSignature(body, signature, process.env.STRIPE_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const event = JSON.parse(body);

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        const billingCustomer = await prisma.billingCustomer.findUnique({
          where: { stripeCustomerId: customerId },
        });
        if (!billingCustomer) break;

        const planMap: Record<string, { plan: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE'; maxDomains: number; maxPages: number; maxScans: number; maxSeats: number }> = {
          [process.env.STRIPE_PRICE_STARTER ?? 'price_starter']: { plan: 'STARTER', maxDomains: 3, maxPages: 200, maxScans: 10, maxSeats: 3 },
          [process.env.STRIPE_PRICE_PROFESSIONAL ?? 'price_professional']: { plan: 'PROFESSIONAL', maxDomains: 10, maxPages: 1000, maxScans: 50, maxSeats: 10 },
          [process.env.STRIPE_PRICE_ENTERPRISE ?? 'price_enterprise']: { plan: 'ENTERPRISE', maxDomains: 100, maxPages: 10000, maxScans: 500, maxSeats: 100 },
        };

        const priceId = subscription.items?.data?.[0]?.price?.id;
        const planConfig = priceId ? planMap[priceId] : null;

        const statusMap: Record<string, 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'TRIALING'> = {
          active: 'ACTIVE',
          past_due: 'PAST_DUE',
          canceled: 'CANCELLED',
          trialing: 'TRIALING',
        };

        await prisma.subscription.upsert({
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
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        const billingCustomer = await prisma.billingCustomer.findUnique({
          where: { stripeCustomerId: customerId },
        });
        if (!billingCustomer) break;

        await prisma.subscription.update({
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
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string
): boolean {
  const parts = header.split(',');
  const timestamp = parts.find((p) => p.startsWith('t='))?.split('=')[1];
  const sig = parts.find((p) => p.startsWith('v1='))?.split('=').slice(1).join('=');

  if (!timestamp || !sig) return false;

  const expectedSig = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');

  return sig === expectedSig;
}
