import { createHash, randomInt, timingSafeEqual } from "crypto";
import type { Prisma, PrismaClient, SecurityTokenKind } from "@aros/db";

const TOKEN_BYTE_LEN = 32;

export function hashSecurityToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function generateOpaqueToken(): string {
  const buf = Buffer.alloc(TOKEN_BYTE_LEN);
  for (let i = 0; i < TOKEN_BYTE_LEN; i++) {
    buf[i] = randomInt(0, 256);
  }
  return buf.toString("base64url");
}

export function timingSafeTokenEquals(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

export async function consumeSecurityToken(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: { rawToken: string; kind: SecurityTokenKind },
): Promise<{ userId: string } | null> {
  const tokenHash = hashSecurityToken(input.rawToken);
  const row = await prisma.securityToken.findUnique({
    where: { tokenHash },
  });
  if (!row || row.kind !== input.kind) return null;
  if (row.usedAt) return null;
  if (row.expiresAt < new Date()) return null;

  await prisma.securityToken.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });

  return { userId: row.userId };
}
