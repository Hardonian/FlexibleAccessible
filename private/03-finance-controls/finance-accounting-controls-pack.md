# Finance & Accounting Controls Pack

**Status:** RECOMMENDED + REQUIRES EXTERNAL REVIEW  
**Purpose:** Establish minimum SaaS financial discipline before scale.  
**Scope:** Revenue treatment, close process, controls, reconciliation, policies.

## Current Truth
- Subscription, customer, usage, and credit transaction records exist in DB.
- Stripe webhook idempotency records exist for event-level duplicate protection.
- Formal accounting policy docs were previously missing.

## Revenue Recognition / Booking Assumptions
- **Monthly subscriptions:** recognize ratably across service period.
- **Annual prepay (if offered):** book cash receipt; recognize as deferred revenue and amortize monthly.
- **Credit packs:** treat as deferred until consumed OR recognize per policy determined with accountant.

## Chart of Accounts (starter recommendation)
- Revenue: Subscription Revenue, Service Revenue, Credit-Pack Revenue.
- Contra-revenue: Discounts, Refunds/Credits.
- Liabilities: Deferred Revenue, Sales Tax Payable.
- COGS/Direct costs: Hosting/infra, AI API usage, contractor delivery.
- Operating expenses: Payroll, software, sales/marketing, G&A.

## Month-End Close Checklist
1. Reconcile Stripe payouts to bank receipts.
2. Reconcile subscriptions and status deltas to internal subscription table.
3. Reconcile credit grants/purchases/refunds to balance table movements.
4. Produce deferred revenue roll-forward (if annual/prepaid in use).
5. Review aged receivables/bad debt and failed-payment retries.
6. Lock month snapshot and store evidence exports.

## Billing Reconciliation Checklist
- Active Stripe subscriptions vs active paid org subscriptions.
- Cancelled/past-due Stripe status vs entitlement lock status.
- Checkout success events without corresponding active entitlement (webhook lag/failure list).
- Refund events reflected in finance records and customer-facing balances.

## Failed Payments / Refund / Bad Debt Policy
- Failed payment: move status to at-risk workflow; notify customer; define grace period.
- Refunds: require documented reason code and approval owner.
- Credits: issue as contra-revenue and audit-log reason.
- Bad debt: write-off after defined aging threshold with owner sign-off.

## Tax / Jurisdiction Caveats
- **REQUIRES EXTERNAL REVIEW:** Nexus, digital services tax, VAT/GST, and US sales tax obligations vary by jurisdiction and customer type.
- Do not represent tax automation completeness until a tax engine/process is implemented and validated.

## Audit Trail Expectations
- Every billing-impacting action should map to durable records (event id, org id, actor, timestamp, reason).
- Preserve Stripe event IDs and reconciliation snapshots monthly.
