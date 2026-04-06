import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { consumeSecurityToken } from "@/lib/security-token";
import { createSession } from "@/lib/session";
import { SecurityTokenKind } from "@aros/db";

export const dynamic = "force-dynamic";

/**
 * One-time email verification from outbound link (GET is standard for mail clients).
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const raw = searchParams.get("token")?.trim();
    if (!raw) {
      return NextResponse.redirect(new URL("/login?verify=invalid", request.url));
    }

    const consumed = await consumeSecurityToken(prisma, {
      rawToken: raw,
      kind: SecurityTokenKind.EMAIL_VERIFICATION,
    });

    if (!consumed) {
      return NextResponse.redirect(new URL("/login?verify=invalid", request.url));
    }

    await prisma.user.update({
      where: { id: consumed.userId },
      data: { emailVerified: true },
    });

    await createSession(consumed.userId);

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (e) {
    console.error("[verify-email] GET failed", e);
    return NextResponse.redirect(new URL("/login?verify=invalid", request.url));
  }
}
