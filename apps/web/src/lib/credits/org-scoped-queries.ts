import { prisma } from "@/lib/db";
import type { OrgMembershipCore } from "@/lib/route-data-boundary";
import { runCanonicalOrgQuery } from "@/lib/server-org-boundary";

export async function getCreditLedger(ctx: OrgMembershipCore) {
  return runCanonicalOrgQuery(ctx, async (organizationId) => {
    const [balance, recentTransactions] = await Promise.all([
      prisma.fixCreditBalance.findUnique({
        where: { organizationId },
      }),
      prisma.fixCredit.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          type: true,
          amount: true,
          description: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      balance: balance?.balance ?? 0,
      totalPurchased: balance?.totalPurchased ?? 0,
      totalSpent: balance?.totalSpent ?? 0,
      totalRefunded: balance?.totalRefunded ?? 0,
      recentTransactions,
    };
  });
}

export async function getBillingCustomerByOrg(ctx: OrgMembershipCore) {
  return runCanonicalOrgQuery(ctx, async (organizationId) =>
    prisma.billingCustomer.findUnique({
      where: { organizationId },
    }),
  );
}

export async function grantDevCredits(
  ctx: OrgMembershipCore,
  input: { credits: number; label: string },
) {
  return runCanonicalOrgQuery(ctx, async (organizationId) => {
    const currentBalance = await prisma.fixCreditBalance.findUnique({
      where: { organizationId },
    });

    const newBalance = (currentBalance?.balance ?? 0) + input.credits;

    await prisma.$transaction([
      prisma.fixCredit.create({
        data: {
          organizationId,
          type: "GRANT",
          amount: input.credits,
          balance: newBalance,
          description: `Dev mode: ${input.label} granted`,
        },
      }),
      prisma.fixCreditBalance.upsert({
        where: { organizationId },
        create: {
          organizationId,
          balance: input.credits,
          totalPurchased: input.credits,
        },
        update: {
          balance: newBalance,
          totalPurchased: { increment: input.credits },
        },
      }),
    ]);

    return { newBalance };
  });
}
