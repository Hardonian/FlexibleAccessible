import type { Prisma, PrismaClient, SecurityTokenKind } from "@aros/db";
import { generateOpaqueToken, hashSecurityToken } from "@/lib/security-token";

const HOUR_MS = 60 * 60 * 1000;

export const PASSWORD_RESET_TTL_MS = 1 * HOUR_MS;
export const EMAIL_VERIFICATION_TTL_MS = 48 * HOUR_MS;

/**
 * Replaces any prior token of this kind for the user. Returns the raw token once (for email links).
 */
export async function issueSecurityToken(
  db: PrismaClient | Prisma.TransactionClient,
  input: { userId: string; kind: SecurityTokenKind; ttlMs: number },
): Promise<string> {
  const raw = generateOpaqueToken();
  const tokenHash = hashSecurityToken(raw);
  await db.securityToken.deleteMany({
    where: { userId: input.userId, kind: input.kind },
  });
  await db.securityToken.create({
    data: {
      userId: input.userId,
      kind: input.kind,
      tokenHash,
      expiresAt: new Date(Date.now() + input.ttlMs),
    },
  });
  return raw;
}
