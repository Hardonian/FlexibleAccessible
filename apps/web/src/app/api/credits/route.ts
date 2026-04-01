import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requireOrgAccess } from "@/lib/auth-guard";
import { apiSuccess, apiError } from "@/lib/api-utils";

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

    const ctx = await requireOrgAccess(organizationId, "billing:manage");

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

    const ctx = await requireOrgAccess(parsed.organizationId, "billing:manage");
    const pack = CREDIT_PACKS[parsed.pack];

    if (!pack) {
      return apiError({ message: "Invalid pack", code: "BAD_REQUEST" });
    }

    // Get or create billing customer
    const billingCustomer = await prisma.billingCustomer.findUnique({
      where: { organizationId: ctx.organizationId },
    });

    if (!billingCustomer) {
      return apiError({
        message: "No billing customer. Please set up billing first.",
        code: "BILLING_REQUIRED",
      });
    }

    // In production, create a Stripe Checkout Session for one-time payment
    // For now, record the purchase intent and return mock checkout URL
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (stripeSecret) {
      const stripe = await import("stripe");
      const client = new stripe.default(stripeSecret);

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

/**
 * Deduct a fix credit for an applied remediation suggestion.
 * Called internally when a suggestion is approved/applied.
 * @internal
 */
export async function deductFixCredit(
  organizationId: string,
  suggestionId: string,
): Promise<{ success: boolean; newBalance: number; error?: string }> {
  const balance = await prisma.fixCreditBalance.findUnique({
    where: { organizationId },
  });

  if (!balance || balance.balance <= 0) {
    return { success: false, newBalance: 0, error: "Insufficient credits" };
  }

  const newBalance = balance.balance - 1;

  await prisma.$transaction([
    prisma.fixCredit.create({
      data: {
        organizationId,
        type: "FIX_APPLIED",
        amount: -1,
        balance: newBalance,
        suggestionId,
        description: "Fix applied",
      },
    }),
    prisma.fixCreditBalance.update({
      where: { organizationId },
      data: {
        balance: newBalance,
        totalSpent: { increment: 1 },
      },
    }),
  ]);

  return { success: true, newBalance };
}
