import { cookies } from "next/headers";
import { prisma } from "./db";

const SESSION_COOKIE = "aros_session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: { select: { id: true, email: true, name: true, emailVerified: true } },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  return session.user;
}

export async function createSession(userId: string): Promise<string> {
  const { generateToken } = await import("@aros/shared");
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE);

  await prisma.session.create({
    data: { userId, token, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE / 1000,
    path: "/",
  });

  return token;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  cookieStore.delete(SESSION_COOKIE);
}

/** Cookie session only; does not enforce email verification (billing, verify-email flows). */
export async function requireAuthenticatedSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) {
    const { ApiError } = await import("@aros/shared");
    throw ApiError.unauthorized();
  }
  return user;
}

/** Full dashboard / API gate: signed in and email verified. */
export async function requireSession(): Promise<SessionUser> {
  const user = await requireAuthenticatedSession();
  if (!user.emailVerified) {
    const { ApiError } = await import("@aros/shared");
    throw new ApiError(
      "Confirm your email address to use this feature.",
      "EMAIL_VERIFICATION_REQUIRED",
      403,
    );
  }
  return user;
}
