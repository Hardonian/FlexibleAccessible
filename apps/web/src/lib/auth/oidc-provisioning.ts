import type { PrismaClient } from "@aros/db";
import type { Prisma } from "@aros/db";
import { slugify } from "@aros/shared";

export type OidcProfile = {
  email: string;
  name: string | null;
  issuer: string;
  subject: string;
};

/**
 * Find or create user for OIDC login. Idempotent on (issuer, subject).
 */
export async function provisionUserFromOidc(
  prisma: PrismaClient,
  profile: OidcProfile,
  options: { jitSignup: boolean; linkExistingByEmail: boolean },
): Promise<{ userId: string; created: boolean }> {
  const existingLinked = await prisma.user.findFirst({
    where: { oidcIssuer: profile.issuer, oidcSubject: profile.subject },
    select: { id: true },
  });
  if (existingLinked) {
    await prisma.user.update({
      where: { id: existingLinked.id },
      data: {
        email: profile.email,
        name: profile.name ?? undefined,
        emailVerified: true,
      },
    });
    return { userId: existingLinked.id, created: false };
  }

  const byEmail = await prisma.user.findUnique({
    where: { email: profile.email },
    select: {
      id: true,
      passwordHash: true,
      oidcIssuer: true,
      oidcSubject: true,
    },
  });

  if (byEmail) {
    if (!options.linkExistingByEmail) {
      throw new Error("OIDC_LINK_EXISTING_EMAIL is disabled for this deployment");
    }
    if (byEmail.oidcIssuer && byEmail.oidcSubject) {
      if (
        byEmail.oidcIssuer !== profile.issuer ||
        byEmail.oidcSubject !== profile.subject
      ) {
        throw new Error("This email is already linked to a different identity provider account");
      }
    }
    await prisma.user.update({
      where: { id: byEmail.id },
      data: {
        oidcIssuer: profile.issuer,
        oidcSubject: profile.subject,
        name: profile.name ?? undefined,
        emailVerified: true,
      },
    });
    return { userId: byEmail.id, created: false };
  }

  if (!options.jitSignup) {
    throw new Error(
      "No matching account. Ask an administrator to invite you or enable OIDC_JIT_SIGNUP.",
    );
  }

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        passwordHash: null,
        emailVerified: true,
        oidcIssuer: profile.issuer,
        oidcSubject: profile.subject,
      },
    });

    const orgBase = profile.email.split("@")[0] || "team";
    const orgName = `${orgBase} (SSO)`;
    let slug = slugify(orgName);
    let n = 0;
    while (await tx.organization.findUnique({ where: { slug } })) {
      n += 1;
      slug = slugify(`${orgName}-${n}`);
    }

    const org = await tx.organization.create({
      data: { name: orgName, slug },
    });

    await tx.membership.create({
      data: { userId: user.id, organizationId: org.id, role: "OWNER" },
    });

    await tx.workspace.create({
      data: { organizationId: org.id, name: "Default", slug: "default" },
    });

    await tx.subscription.create({
      data: {
        organizationId: org.id,
        plan: "FREE",
        status: "ACTIVE",
        maxDomains: 1,
        maxPagesPerCrawl: 50,
        maxScansPerMonth: 3,
        maxSeats: 1,
      },
    });

    return user.id;
  });

  return { userId: result, created: true };
}
