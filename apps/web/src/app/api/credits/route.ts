import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requireOrgAccess } from "@/lib/auth-guard";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { ApiError } from "@aros/shared";

const purchaseSchema = z.object({
  organizationId: z.string().min(1),
  pack: z.enum(["small", "medium", "large"]),
});

const CREDIT_PACKS: Record<
  string,
  { credits: number; priceCents: number; label: string }
> = {
  small: { credits: 100, priceCents: 900, label: "100 fix credits" },
  medium: { credits: 500, priceCents: 3900, label: "500 fix credits" },
  large: { credits: 2000, priceCents: 12900, label: "2000 fix credits" },
};

/**
 * GET /api/credits?organizationId=xxx
 * Get current fix credit balance for an organization.
 */
export async function GET(request: Request) {
  try {
    const user = await requireSession();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return apiError({
        message: "organizationId required",
        code: "BAD_REQUEST",
      });
    }

    const ctx = await requireOrgAccess(organizationId, "org:billing", {
      requirePaid: true,
    });

    const balance = await prisma.fixCreditBalance.findUnique({
      where: { organizationId: ctx.organizationId },
    });

    const recentTransactions = await prisma.fixCredit.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        type: true,
        amount: true,
        description: true,
        createdAt: true,
      },
    });

    return apiSuccess({
      balance: balance?.balance ?? 0,
      totalPurchased: balance?.totalPurchased ?? 0,
      totalSpent: balance?.totalSpent ?? 0,
      totalRefunded: balance?.totalRefunded ?? 0,
      recentTransactions,
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
    const user = await requireSession();
    const body = await request.json();
    const parsed = purchaseSchema.parse(body);

    const ctx = await requireOrgAccess(parsed.organizationId, "org:billing", {
      requirePaid: true,
    });
    const pack = CREDIT_PACKS[parsed.pack];

    if (!pack) {
      return apiError(ApiError.badRequest("Invalid pack"));
    }

    // Get or create billing customer
    const billingCustomer = await prisma.billingCustomer.findUnique({
      where: { organizationId: ctx.organizationId },
    });

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
          success_url: `${process.env.NEXTAUTH_URL}/settings/billing?credits=success`,
          cancel_url: `${process.env.NEXTAUTH_URL}/settings/billing?credits=cancelled`,
        });

        return apiSuccess({ checkoutUrl: session.url });
      }
    }

    // Development mode: directly grant credits
    const currentBalance = await prisma.fixCreditBalance.findUnique({
      where: { organizationId: ctx.organizationId },
    });

    const newBalance = (currentBalance?.balance ?? 0) + pack.credits;

    await prisma.$transaction([
      prisma.fixCredit.create({
        data: {
          organizationId: ctx.organizationId,
          type: "GRANT",
          amount: pack.credits,
          balance: newBalance,
          description: `Dev mode: ${pack.label} granted`,
        },
      }),
      prisma.fixCreditBalance.upsert({
        where: { organizationId: ctx.organizationId },
        create: {
          organizationId: ctx.organizationId,
          balance: pack.credits,
          totalPurchased: pack.credits,
        },
        update: {
          balance: newBalance,
          totalPurchased: { increment: pack.credits },
        },
      }),
    ]);

    return apiSuccess({
      message: `${pack.credits} credits granted (dev mode)`,
      newBalance,
    });
  } catch (error) {
    return apiError(error);
  }
}
