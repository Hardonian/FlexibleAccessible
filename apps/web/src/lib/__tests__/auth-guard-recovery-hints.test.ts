import { describe, expect, it } from "vitest";
import { entitlementRecoveryHints, type OrgSubscriptionSnapshot } from "../auth-guard";

const base: OrgSubscriptionSnapshot = {
  plan: "STARTER",
  status: "ACTIVE",
  maxDomains: 3,
  maxPagesPerCrawl: 200,
  maxScansPerMonth: 10,
  maxSeats: 3,
  aiEnabled: false,
  aiTokenLimit: 0,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

describe("entitlementRecoveryHints", () => {
  it("includes past_due payment guidance", () => {
    const hints = entitlementRecoveryHints(
      { hasPaidAccess: false, reason: "past_due" },
      base,
    );
    expect(hints.some((h) => h.includes("Stripe"))).toBe(true);
  });

  it("notes trialing parity with paid routes", () => {
    const hints = entitlementRecoveryHints(
      { hasPaidAccess: true, reason: "active_paid" },
      { ...base, status: "TRIALING" },
    );
    expect(hints.some((h) => h.toLowerCase().includes("trial"))).toBe(true);
  });
});
