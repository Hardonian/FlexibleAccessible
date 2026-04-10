# AROS Billing Integration

**Date:** 2026-04-10  
**Status:** Active

---

## Pricing Tiers

| Tier | Price | Pages/mo | Scans | AI Fixes |
|------|-------|---------|------|---------|
| Free | $0 | 100/mo | 100/mo | 10/mo |
| Starter | $99/mo | 5,000/mo | 5,000/mo | 100/mo |
| Growth | $299/mo | 25,000/mo | 25,000/mo | 500/mo |
| Enterprise | Custom | Unlimited | Unlimited | Unlimited |

---

## Quota System

### 1. Track Usage

```typescript
// Track scans
async function trackScan(orgId: string) {
  const org = await db.organizations.findUnique({ where: { id: orgId }});
  const usage = await db.usageRecords.aggregate({
    where: { 
      orgId,
      type: 'scan',
      created: { gte: startOfMonth() },
    },
    _count: true,
  });
  
  const limit = PLANS[org.plan].scans;
  if (usage._count >= limit) {
    throw new Error('Scan quota exceeded');
  }
  
  await db.usageRecords.create({
    data: { orgId, type: 'scan' },
  });
}

// Track AI fixes
async function trackAIFix(orgId: string) {
  // Same pattern as scans
  const usage = await getUsage(orgId, 'ai_fix');
  const limit = PLANS[org.plan].ai_fixes;
  
  if (usage >= limit) {
    throw new Error('AI fix quota exceeded');
  }
}
```

### 2. Webhook for Usage Alerts

```typescript
// Alert at 80% quota
async function checkQuotaAlert(orgId: string) {
  const org = await db.organizations.findUnique({ where: { id: orgId }});
  const usage = await getUsage(orgId);
  const limit = PLANS[org.plan].pages;
  const percentUsed = (usage / limit) * 100;
  
  if (percentUsed >= 80 && !org.quotaAlertSent) {
    await sendEmail(orgId, `You've used ${percentUsed}% of your quota`);
    await db.organizations.update({
      where: { id: orgId },
      data: { quotaAlertSent: true },
    });
  }
}
```

### 3. Usage Dashboard

```typescript
// Get organization usage
async function getOrgUsage(orgId: string) {
  const scans = await getUsage(orgId, 'scan');
  const pages = await getUsage(orgId, 'page');
  const aiFixes = await getUsage(orgId, 'ai_fix');
  
  const org = await db.organizations.findUnique({ where: { id: orgId }});
  const limits = PLANS[org.plan];
  
  return {
    scans: { used: scans, limit: limits.scans },
    pages: { used: pages, limit: limits.pages },
    aiFixes: { used: aiFixes, limit: limits.ai_fixes },
  };
}
```

---

## Stripe Integration

### Subscription Creation

```typescript
// Create subscription
async function createSubscription(orgId: string, plan: string) {
  const org = await db.organizations.findUnique({ where: { id: orgId }});
  const stripeCustomerId = org.stripeCustomerId || await createStripeCustomer(org);
  
  const subscription = await stripe.subscriptions.create({
    customer: stripeCustomerId,
    items: [{ price: PLANS[plan].priceId }],
    metadata: { orgId },
  });
  
  await db.organizations.update({
    where: { id: orgId },
    data: { 
      plan,
      stripeSubscriptionId: subscription.id,
      subscriptionEnds: new Date(subscription.current_period_end * 1000),
    },
  });
  
  return subscription;
}
```

### Webhook Handling

```typescript
// Handle subscription events
async function handleStripeWebhook(event: any) {
  switch (event.type) {
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionCancel(event.data.object);
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
  }
}
```

---

## Revenue Analytics

```typescript
// Get MRR
async function getMRR() {
  const subscriptions = await stripe.subscriptions.list({
    status: 'active',
    limit: 100,
  });
  
  let mrr = 0;
  for (const sub of subscriptions.data) {
    const price = sub.items.data[0].price.unit_amount || 0;
    mrr += (price * sub.items.data[0].quantity) / 100;
  }
  
  return mrr;
}

// Get ARR
const ARR = MRR * 12;

// Get churn
async function getChurnRate() {
  const cancelled = await stripe.subscriptions.list({
    status: 'canceled',
    created: { gte: startOfMonth() },
  });
  
  const active = await stripe.subscriptions.list({
    status: 'active',
  });
  
  return (cancelled.data.length / active.data.length) * 100;
}
```

---

## Environment Variables

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_GROWTH=price_...
STRIPE_PRICE_ENTERPRISE=price_...
```

---

*Status: Ready for production*