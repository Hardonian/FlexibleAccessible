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

import { GET, POST } from "./route";
import { isPrivateOrLoopbackAddress, validatePublicScanTarget } from "@/lib/public-scan/target-validation";

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
    expect(payload.error?.details?.evidenceState).toBe("expired");
  });

  it("rejects URLs with embedded credentials", async () => {
    const request = new Request("http://localhost/api/public-scan", {
      method: "POST",
      body: JSON.stringify({ domain: "https://user:pass@example.com" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error?.message).toMatch(/embedded credentials/i);
  });

  it("rejects URLs that target non-default ports", async () => {
    const request = new Request("http://localhost/api/public-scan", {
      method: "POST",
      body: JSON.stringify({ domain: "https://example.com:8443" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error?.message).toMatch(/default http/i);
  });

  it("rejects URLs with query strings", async () => {
    const request = new Request("http://localhost/api/public-scan", {
      method: "POST",
      body: JSON.stringify({ domain: "https://example.com/?foo=bar" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error?.message).toMatch(/query strings/i);
  });

  it("rejects URLs with fragments", async () => {
    const request = new Request("http://localhost/api/public-scan", {
      method: "POST",
      body: JSON.stringify({ domain: "https://example.com/#section" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error?.message).toMatch(/fragments/i);
  });
});
