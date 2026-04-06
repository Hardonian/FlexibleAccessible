"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { abuseRateLimit } from "@aros/shared";
import { getEmailOutboundSummary } from "@aros/config";
import { getClientIpFromHeaders } from "@/lib/client-ip";
import { issueSecurityToken, PASSWORD_RESET_TTL_MS } from "@/lib/auth-tokens";
import { sendTransactionalMail } from "@/lib/mail";
import { getAppBaseUrl } from "@/lib/site-url";
import { SecurityTokenKind } from "@aros/db";

interface ForgotState {
  error: string | null;
  /** Generic success copy (no enumeration). */
  submitted: boolean;
}

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

async function uniformDelay(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function forgotPasswordAction(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const emailRaw = (formData.get("email") as string)?.trim().toLowerCase();
  if (!emailRaw) {
    return { error: "Email is required", submitted: false };
  }

  const h = await headers();
  const ip = getClientIpFromHeaders(h);
  const rl = await abuseRateLimit(`forgot-pw:${ip}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!rl.allowed) {
    return {
      error: "Too many attempts. Try again later.",
      submitted: false,
    };
  }

  const emailConfigured = getEmailOutboundSummary(process.env).configured;
  if (!emailConfigured) {
    await uniformDelay(400);
    return {
      error:
        "Password reset email is not enabled on this deployment. Ask an operator to configure SMTP or contact support.",
      submitted: false,
    };
  }

  const user = await prisma.user.findUnique({ where: { email: emailRaw } });
  if (!user) {
    await uniformDelay(400);
    return { error: null, submitted: true };
  }

  const raw = await issueSecurityToken(prisma, {
    userId: user.id,
    kind: SecurityTokenKind.PASSWORD_RESET,
    ttlMs: PASSWORD_RESET_TTL_MS,
  });

  const base = getAppBaseUrl();
  const link = `${base}/reset-password/${encodeURIComponent(raw)}`;

  try {
    await sendTransactionalMail({
      to: user.email,
      subject: "Reset your FlexibleAccessible password",
      text: `We received a request to reset the password for ${user.email}.\n\nOpen this link to choose a new password (single use, expires in 1 hour):\n${link}\n\nIf you did not request this, you can ignore this email.`,
    });
  } catch (e) {
    console.error("[forgot-password] send failed", e);
    return {
      error:
        "Password reset email could not be sent right now. Try again later or contact support.",
      submitted: false,
    };
  }

  return { error: null, submitted: true };
}
