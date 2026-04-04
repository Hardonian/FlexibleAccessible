import { describe, expect, it } from "vitest";
import { getBillingPlanCards, getAppBaseUrl } from "./billing";

describe("billing re-exports", () => {
  it("exposes getAppBaseUrl from site-url module", () => {
    expect(typeof getAppBaseUrl).toBe("function");
  });

  it("getBillingPlanCards returns four tiers", () => {
    expect(getBillingPlanCards()).toHaveLength(4);
  });
});
