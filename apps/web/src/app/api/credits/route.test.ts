import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({
  requireAuthenticatedSession: vi.fn(),
}));

vi.mock("@/lib/auth-guard", () => ({
  requireOrgAccess: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    billingCustomer: {
      findUnique: vi.fn(),
    },
  },
}));

const mockStripeCreateSession = vi.fn();
vi.mock("stripe", () => ({
  default: vi.fn(function StripeMock() {
    return {
      checkout: {
        sessions: {
          create: mockStripeCreateSession,
        },
      },
    };
  }),
}));

import { POST } from "./route";
import { requireOrgAccess } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { requireAuthenticatedSession } from "@/lib/session";

describe("POST /api/credits", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.NEXTAUTH_URL = "https://app.flexibleaccessible.test";

    vi.mocked(requireAuthenticatedSession).mockResolvedValue({
      id: "user_123",
      email: "user_123@flexibleaccessible.test",
      name: "Route Test User",
      emailVerified: false,
    });

    vi.mocked(requireOrgAccess).mockResolvedValue({
      organizationId: "org_123",
      user: { id: "user_123" },
      role: "OWNER",
      subscription: null,
      entitlement: { hasPaidAccess: true, reason: "active_paid" },
    } as never);

    vi.mocked(prisma.billingCustomer.findUnique).mockResolvedValue({
      organizationId: "org_123",
      stripeCustomerId: "cus_123",
    } as never);

    mockStripeCreateSession.mockResolvedValue({
      url: "https://checkout.stripe.test/session_123",
    });
  });

  it("passes exact success and cancel URLs to Stripe checkout session creation", async () => {
    const request = new Request("http://localhost/api/credits", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationId: "org_123",
        pack: "small",
      }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(requireAuthenticatedSession).toHaveBeenCalledTimes(1);

    expect(mockStripeCreateSession).toHaveBeenCalledTimes(1);
    const createPayload = mockStripeCreateSession.mock.calls[0]?.[0];

    expect(createPayload?.success_url).toBe(
      "https://app.flexibleaccessible.test/settings/billing?credits=success",
    );
    expect(createPayload?.cancel_url).toBe(
      "https://app.flexibleaccessible.test/settings/billing?credits=cancelled",
    );
  });
});
