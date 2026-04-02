"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import { verifyPassword } from "@aros/shared";
import { timingSafeEqual } from "crypto";

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

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
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
