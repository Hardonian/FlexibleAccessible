"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import type { Prisma } from "@aros/db";
import { SecurityTokenKind } from "@aros/db";
import { createSession } from "@/lib/session";
import { abuseRateLimit, hashPassword, slugify } from "@aros/shared";
import { getEmailOutboundSummary } from "@aros/config";
import { getClientIpFromHeaders } from "@/lib/client-ip";
import { issueSecurityToken, EMAIL_VERIFICATION_TTL_MS } from "@/lib/auth-tokens";
import { sendTransactionalMail } from "@/lib/mail";
import { getAppBaseUrl } from "@/lib/site-url";

interface SignupState {
  error: string | null;
}

const SIGNUP_WINDOW_MS = 60 * 60 * 1000;
const SIGNUP_MAX_PER_WINDOW = 10;

export async function signupAction(
  _prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const name = (formData.get("name") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const orgName = (formData.get("orgName") as string)?.trim();

  if (!name || !email || !password || !orgName) {
    return { error: "All fields are required" };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters" };
  }

  const h = await headers();
  const ip = getClientIpFromHeaders(h);
  const rl = await abuseRateLimit(`signup:${ip}`, SIGNUP_MAX_PER_WINDOW, SIGNUP_WINDOW_MS);
  if (!rl.allowed) {
    return { error: "Too many signup attempts from this network. Try again later." };
  }

  const headerList = await headers();
  const ip = getClientIpFromHeaders(headerList);
  const rlKeyIp = `auth:signup:ip:${createHash('sha256').update(ip).digest('hex').slice(0, 32)}`;
  const rlIp = await rateLimitSafe(rlKeyIp, 10, 60 * 60 * 1000);
  if (!rlIp.success) {
    return {
      error:
        'Too many sign-up attempts from this network. Please try again later.',
    };
  }

  const rlKeyEmail = `auth:signup:email:${createHash('sha256').update(email).digest('hex').slice(0, 32)}`;
  const rlEmail = await rateLimitSafe(rlKeyEmail, 5, 24 * 60 * 60 * 1000);
  if (!rlEmail.success) {
    return {
      error:
        'Too many sign-up attempts for this email. Please try again tomorrow or contact support.',
    };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: 'An account with this email already exists' };
  }

  const passwordHash = await hashPassword(password);
  const orgSlug = slugify(orgName);

  const existingOrg = await prisma.organization.findUnique({ where: { slug: orgSlug } });
  if (existingOrg) {
    return {
      error:
        "An organization with a similar name already exists. Please choose a different name.",
    };
  }

  const emailOutbound = getEmailOutboundSummary(process.env);
  const skipVerificationInDev =
    process.env.NODE_ENV === "development" && !emailOutbound.configured;

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.create({
      data: {
        email,
        name,
        passwordHash,
        emailVerified: skipVerificationInDev,
      },
    });

    const org = await tx.organization.create({
      data: { name: orgName, slug: orgSlug },
    });

    await tx.membership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: "OWNER",
      },
    });

    await tx.workspace.create({
      data: {
        organizationId: org.id,
        name: "Default",
        slug: "default",
      },
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

    return { user, organizationId: org.id };
  });

  async function rollbackSignup() {
    await prisma.$transaction(async (tx) => {
      await tx.organization.delete({ where: { id: result.organizationId } });
      await tx.user.delete({ where: { id: result.user.id } });
    });
  }

  if (skipVerificationInDev) {
    await createSession(result.user.id);
    redirect("/settings/billing?status=upgrade_required&from=%2Fdashboard");
  }

  if (emailOutbound.configured) {
    const raw = await issueSecurityToken(prisma, {
      userId: result.user.id,
      kind: SecurityTokenKind.EMAIL_VERIFICATION,
      ttlMs: EMAIL_VERIFICATION_TTL_MS,
    });
    const base = getAppBaseUrl();
    const link = `${base}/api/auth/verify-email?token=${encodeURIComponent(raw)}`;
    try {
      await sendTransactionalMail({
        to: result.user.email,
        subject: "Confirm your FlexibleAccessible email",
        text: `Hi ${result.user.name ?? ""},\n\nConfirm your email for FlexibleAccessible (single use, expires in 48 hours):\n${link}\n\nIf you did not create this account, ignore this message.`,
      });
    } catch (e) {
      console.error("[signup] verification email failed", e);
      await rollbackSignup().catch(() => {});
      return {
        error:
          "We could not send the confirmation email. No account was created. Try again shortly or contact support.",
      };
    }
  } else {
    await rollbackSignup().catch(() => {});
    return {
      error:
        "New signups require outbound email to be configured on this deployment. Ask an operator to set SMTP_* and EMAIL_FROM, or contact support for a managed invite.",
    };
  }

  await createSession(result.user.id);
  redirect("/verify-email");
}
