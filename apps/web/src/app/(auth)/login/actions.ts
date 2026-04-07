"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import { abuseRateLimit, verifyPassword } from "@aros/shared";
import { getClientIpFromHeaders } from "@/lib/client-ip";

interface LoginState {
  error: string | null;
}

const DUMMY_HASH =
  "$argon2id$v=19$m=65536,t=3,p=1$dummy$dummyhashdummyhashdummyhashdum";

async function constantTimeVerify(
  password: string,
  hash: string,
): Promise<boolean> {
  const start = Date.now();
  try {
    const result = await verifyPassword(password, hash);
    return result;
  } catch {
    return false;
  } finally {
    // Enforce minimum 150ms response time to reduce timing attack surface
    const elapsed = Date.now() - start;
    if (elapsed < 150) {
      await new Promise((resolve) => setTimeout(resolve, 150 - elapsed));
    }
  }
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_PER_IP = 30;

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const emailNorm = email.trim().toLowerCase();

  const h = await headers();
  const ip = getClientIpFromHeaders(h);
  const rl = await abuseRateLimit(`login:${ip}`, LOGIN_MAX_PER_IP, LOGIN_WINDOW_MS);
  if (!rl.allowed) {
    return { error: "Too many sign-in attempts. Try again in a few minutes." };
  }

  const user = await prisma.user.findUnique({
    where: { email: emailNorm },
  });
  if (!user) {
    // Perform a dummy hash verification to prevent user enumeration via timing
    await constantTimeVerify(password, DUMMY_HASH);
    return { error: "Invalid email or password" };
  }

  if (!user.passwordHash) {
    await constantTimeVerify(password, DUMMY_HASH);
    return {
      error:
        "This account uses single sign-on. Use the “Continue with SSO” option on the sign-in page.",
    };
  }

  const valid = await constantTimeVerify(password, user.passwordHash);
  if (!valid) {
    return { error: "Invalid email or password" };
  }

  if (!user.emailVerified) {
    await createSession(user.id);
    redirect("/verify-email");
  }

  await createSession(user.id);
  redirect("/dashboard");
}
