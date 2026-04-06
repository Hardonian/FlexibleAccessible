import { describe, expect, it, vi } from "vitest";
import { consumeSecurityToken, hashSecurityToken } from "./security-token";
import { SecurityTokenKind } from "@aros/db";

describe("security-token", () => {
  it("hashSecurityToken is stable for same input", () => {
    const h = hashSecurityToken("abc");
    expect(h).toBe(hashSecurityToken("abc"));
    expect(h).not.toBe(hashSecurityToken("abd"));
  });

  it("consumeSecurityToken marks used and rejects reuse", async () => {
    const raw = "test-raw-token";
    const tokenHash = hashSecurityToken(raw);
    const row = {
      id: "t1",
      userId: "u1",
      kind: SecurityTokenKind.PASSWORD_RESET,
      usedAt: null as Date | null,
      expiresAt: new Date(Date.now() + 60_000),
    };
    const prisma = {
      securityToken: {
        findUnique: vi.fn().mockResolvedValue({ ...row }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const first = await consumeSecurityToken(prisma as any, {
      rawToken: raw,
      kind: SecurityTokenKind.PASSWORD_RESET,
    });
    expect(first).toEqual({ userId: "u1" });
    expect(prisma.securityToken.update).toHaveBeenCalled();

    prisma.securityToken.findUnique.mockResolvedValue({
      ...row,
      usedAt: new Date(),
    });
    const second = await consumeSecurityToken(prisma as any, {
      rawToken: raw,
      kind: SecurityTokenKind.PASSWORD_RESET,
    });
    expect(second).toBeNull();
  });
});
