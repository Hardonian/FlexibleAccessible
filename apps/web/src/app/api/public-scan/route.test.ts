import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    publicScanResult: {
      findUnique: findUniqueMock,
    },
  },
}));

import { GET, isPrivateOrLoopbackAddress, validatePublicScanTarget } from "./route";

describe("public scan target validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks loopback/private literal addresses", () => {
    expect(isPrivateOrLoopbackAddress("127.0.0.1")).toBe(true);
    expect(isPrivateOrLoopbackAddress("10.0.0.4")).toBe(true);
    expect(isPrivateOrLoopbackAddress("192.168.1.9")).toBe(true);
    expect(isPrivateOrLoopbackAddress("8.8.8.8")).toBe(false);
    expect(isPrivateOrLoopbackAddress("::1")).toBe(true);
    expect(isPrivateOrLoopbackAddress("2001:4860:4860::8888")).toBe(false);
  });

  it("rejects domains that resolve to private addresses", async () => {
    await expect(validatePublicScanTarget("localhost")).rejects.toMatchObject({
      code: "PUBLIC_SCAN_HOST_BLOCKED",
      statusCode: 400,
    });
  });
});

describe("GET /api/public-scan?id=...", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 410 for expired scans", async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: "scan_1",
      domain: "example.com",
      status: "COMPLETED",
      expiresAt: new Date(Date.now() - 60_000),
    });

    const request = new Request("http://localhost/api/public-scan?id=scan_1");
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(410);
    expect(payload.error?.code).toBe("SCAN_EXPIRED");
  });
});
