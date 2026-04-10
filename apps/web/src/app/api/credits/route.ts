import { z } from "zod";
import { requireAuthenticatedSession } from "@/lib/session";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { getAppBaseUrl } from "@/lib/billing";
import { ApiError } from "@aros/shared";
import { requireCanonicalOrgAccess } from "@/lib/server-org-boundary";
import { getBillingCustomerByOrg, getCreditLedger, grantDevCredits } from "@/lib/credits/org-scoped-queries";
import { CREDIT_PACKS, type CreditPackId } from "@/lib/credits/packs";

const purchaseSchema = z.object({
  organizationId: z.string().min(1),
  pack: z.enum(["small", "medium", "large"]),
});

/**
 * GET /api/credits?organizationId=xxx
 * Get current fix credit balance for an organization.
 */
export async function GET(request: Request) {
  try {
    await requireAuthenticatedSession();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return apiError({
        message: "organizationId required",
        code: "BAD_REQUEST",
      });
    }

    const ctx = await requireCanonicalOrgAccess(organizationId, "org:billing", {
      requirePaid: true,
    });

    const ledger = await getCreditLedger(ctx);

    return apiSuccess({
      ...ledger,
      packs: Object.entries(CREDIT_PACKS).map(([key, pack]) => ({
        id: key,
        ...pack,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * POST /api/credits
 * Purchase fix credits. Creates a Stripe checkout session and returns the URL.
 */
export async function POST(request: Request) {
  try {
    await requireAuthenticatedSession();
    const body = await request.json();
    const parsed = purchaseSchema.parse(body);

    const ctx = await requireCanonicalOrgAccess(parsed.organizationId, "org:billing", {
      requirePaid: true,
    });
    const pack = CREDIT_PACKS[parsed.pack as CreditPackId];

    if (!pack) {
      return apiError(ApiError.badRequest("Invalid pack"));
    }

    // Get or create billing customer
    const billingCustomer = await getBillingCustomerByOrg(ctx);

    if (!billingCustomer) {
      return apiError(
        ApiError.badRequest(
          "No billing customer. Please set up billing first.",
        ),
      );
    }

    // In production, create a Stripe Checkout Session for one-time payment.
    // Requires the 'stripe' package: npm install stripe
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (stripeSecret) {
      // Dynamic import to avoid build-time dependency when stripe is not installed
      let Stripe: any;
      try {
        Stripe = (await import("stripe" as string)).default;
      } catch {
        Stripe = null;
      }

      if (Stripe) {
        const client = new Stripe(stripeSecret);
        const appBaseUrl = getAppBaseUrl();

        const session = await client.checkout.sessions.create({
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
            creditPack: parsed.pack,
            creditAmount: String(pack.credits),
          },
          success_url: `${appBaseUrl}/settings/billing?credits=success`,
          cancel_url: `${appBaseUrl}/settings/billing?credits=cancelled`,
        });

        return apiSuccess({ checkoutUrl: session.url });
      }
    }

    // Development mode: directly grant credits
    const { newBalance } = await grantDevCredits(ctx, {
      credits: pack.credits,
      label: pack.label,
    });

    return apiSuccess({
      message: `${pack.credits} credits granted (dev mode)`,
      newBalance,
    });
  } catch (error) {
    return apiError(error);
  }
}
