"use server";

import { prisma } from "@/lib/db";
import { requireAuthenticatedSession } from "@/lib/session";
import { SecurityTokenKind } from "@aros/db";
import { issueSecurityToken, EMAIL_VERIFICATION_TTL_MS } from "@/lib/auth-tokens";
import { sendTransactionalMail } from "@/lib/mail";
import { getAppBaseUrl } from "@/lib/site-url";
import { getEmailOutboundSummary } from "@aros/config";
import { abuseRateLimit } from "@aros/shared";

interface ResendState {
  error: string | null;
  ok: boolean;
}

const WINDOW_MS = 60 * 60 * 1000;
const MAX_RESEND = 3;

export async function resendVerificationAction(
  _prev: ResendState,
  _formData: FormData,
): Promise<ResendState> {
  const user = await requireAuthenticatedSession();
  if (user.emailVerified) {
    return { error: null, ok: true };
  }

  const outbound = getEmailOutboundSummary(process.env);
  if (!outbound.configured) {
    return {
      error:
        "Email delivery is not configured on this deployment. Contact your operator or support.",
      ok: false,
    };
  }

  const rl = await abuseRateLimit(`verify-resend:${user.id}`, MAX_RESEND, WINDOW_MS);
  if (!rl.allowed) {
    return {
      error: "Too many resend attempts. Wait up to an hour and try again.",
      ok: false,
    };
  }

  const raw = await issueSecurityToken(prisma, {
    userId: user.id,
    kind: SecurityTokenKind.EMAIL_VERIFICATION,
    ttlMs: EMAIL_VERIFICATION_TTL_MS,
  });
  const base = getAppBaseUrl();
  const link = `${base}/api/auth/verify-email?token=${encodeURIComponent(raw)}`;

  try {
    await sendTransactionalMail({
      to: user.email,
      subject: "Confirm your FlexibleAccessible email",
      text: `Confirm your email for FlexibleAccessible (single use, expires in 48 hours):\n${link}`,
    });
  } catch (e) {
    console.error("[verify-email] resend failed", e);
    return {
      error: "Could not send email right now. Try again in a few minutes.",
      ok: false,
    };
  }

  return { error: null, ok: true };
}
