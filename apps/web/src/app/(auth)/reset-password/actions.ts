"use server";

import { redirect } from "next/navigation";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@aros/shared";
import { consumeSecurityToken } from "@/lib/security-token";
import { SecurityTokenKind } from "@aros/db";

function constantTimeStringEq(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export interface ResetPasswordState {
  error: string | null;
  token: string;
}

export async function resetPasswordAction(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = (formData.get("token") as string) ?? "";
  const password = formData.get("password") as string;
  const confirm = formData.get("confirm") as string;

  if (!token) {
    return { error: "This reset link is invalid or has expired.", token: "" };
  }

  if (!password || password.length < 8) {
    return {
      error: "Password must be at least 8 characters.",
      token,
    };
  }

  if (!constantTimeStringEq(password, confirm)) {
    return { error: "Passwords do not match.", token };
  }

  const consumed = await consumeSecurityToken(prisma, {
    rawToken: token,
    kind: SecurityTokenKind.PASSWORD_RESET,
  });

  if (!consumed) {
    return {
      error:
        "This reset link is invalid, expired, or was already used. Request a new one from the sign-in page.",
      token: "",
    };
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: consumed.userId },
    data: { passwordHash },
  });

  await prisma.session.deleteMany({ where: { userId: consumed.userId } });

  redirect("/login?reset=success");
}
