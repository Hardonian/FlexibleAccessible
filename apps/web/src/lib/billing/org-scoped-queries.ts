import { prisma } from "@/lib/db";
import type { OrgMembershipCore } from "@/lib/route-data-boundary";
import { runCanonicalOrgQuery } from "@/lib/server-org-boundary";

export async function getBillingCustomer(ctx: OrgMembershipCore) {
  return runCanonicalOrgQuery(ctx, async (organizationId) =>
    prisma.billingCustomer.findUnique({
      where: { organizationId },
    }),
  );
}

export async function getOrCreateBillingCustomer(
  ctx: OrgMembershipCore,
  input: {
    createStripeCustomerId: () => Promise<string>;
  },
) {
  return runCanonicalOrgQuery(ctx, async (organizationId) => {
    const existing = await prisma.billingCustomer.findUnique({
      where: { organizationId },
    });

    if (existing) {
      return existing;
    }

    const stripeCustomerId = await input.createStripeCustomerId();
    return prisma.billingCustomer.create({
      data: {
        organizationId,
        stripeCustomerId,
      },
    });
  });
}
