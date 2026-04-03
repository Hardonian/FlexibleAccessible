import { describe, expect, it } from "vitest";

import { validatePublicScanTarget } from "./target-validation";

describe("validatePublicScanTarget", () => {
  it("rejects ip literal hosts", async () => {
    await expect(validatePublicScanTarget("127.0.0.1")).rejects.toMatchObject({
      code: "PUBLIC_SCAN_HOST_BLOCKED",
      statusCode: 400,
    });
  });

  it("rejects local domains", async () => {
    await expect(validatePublicScanTarget("internal.local")).rejects.toMatchObject({
      code: "PUBLIC_SCAN_HOST_BLOCKED",
      statusCode: 400,
    });
  });

  it("rejects unresolvable hostnames", async () => {
    await expect(validatePublicScanTarget("not-a-real-hostname.invalid"))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});
