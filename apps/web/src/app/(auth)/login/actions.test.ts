import { beforeEach, describe, expect, it, vi } from "vitest";
import { loginAction } from "./actions";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    membership: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/session", () => ({ createSession: vi.fn() }));
vi.mock("@aros/shared", () => ({ abuseRateLimit: vi.fn(), verifyPassword: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/client-ip", () => ({ getClientIpFromHeaders: vi.fn(() => "127.0.0.1") }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { prisma } from "@/lib/db";
import { abuseRateLimit, verifyPassword } from "@aros/shared";

describe("loginAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(abuseRateLimit).mockResolvedValue({ allowed: true } as any);
  });

  it("blocks password login when org policy enforces SSO only", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user_1",
      email: "person@example.com",
      passwordHash: "hash",
      emailVerified: true,
    } as any);
    vi.mocked(verifyPassword).mockResolvedValue(true as any);
    vi.mocked(prisma.membership.findMany).mockResolvedValue([
      { organization: { authPolicy: { loginMode: "SSO_ONLY" } } },
    ] as any);

    const formData = new FormData();
    formData.set("email", "person@example.com");
    formData.set("password", "hunter2hunter2");

    const result = await loginAction({ error: null }, formData);
    expect(result.error).toContain("Password sign-in is disabled by your organization policy");
  });
});
