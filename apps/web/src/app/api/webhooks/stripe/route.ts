import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleStripeWebhookRequest, type StripeWebhookEnv } from '@/lib/stripe-webhook';

function getStripeEnv(): StripeWebhookEnv | null {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return null;
  return {
    webhookSecret,
    priceStarter: process.env.STRIPE_PRICE_STARTER ?? 'price_starter',
    priceProfessional: process.env.STRIPE_PRICE_PROFESSIONAL ?? 'price_professional',
    priceEnterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? 'price_enterprise',
  };
}

export async function POST(request: Request) {
  try {
    const env = getStripeEnv();
    if (!env) {
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    const result = await handleStripeWebhookRequest(body, signature, env, prisma);

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }

    return NextResponse.json({ received: true, duplicate: result.duplicate });
  } catch {
    return NextResponse.json({ error: 'Unhandled webhook error' }, { status: 500 });
  }
}
