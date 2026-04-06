"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import { verifyPassword } from "@aros/shared";
import { rateLimitSafe } from "@/lib/rate-limit";
import { getClientIpFromHeaders } from "@/lib/request-ip";

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

export async function loginAction(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const headerList = await headers();
  const ip = getClientIpFromHeaders(headerList);
  const emailNorm = email.toLowerCase().trim();
  const rlKey = `auth:login:${createHash("sha256").update(`${ip}:${emailNorm}`).digest("hex").slice(0, 32)}`;
  const rl = await rateLimitSafe(rlKey, 20, 15 * 60 * 1000);
  if (!rl.success) {
    return {
      error:
        "Too many sign-in attempts. Please wait a few minutes and try again.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: emailNorm },
  });
  if (!user) {
    // Perform a dummy hash verification to prevent user enumeration via timing
    await constantTimeVerify(password, DUMMY_HASH);
    return { error: "Invalid email or password" };
  }

  const valid = await constantTimeVerify(password, user.passwordHash);
  if (!valid) {
    return { error: "Invalid email or password" };
  }

  await createSession(user.id);
  redirect("/dashboard");
}
