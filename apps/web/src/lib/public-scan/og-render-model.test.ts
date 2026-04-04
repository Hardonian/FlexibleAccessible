import { beforeEach, describe, expect, it, vi } from "vitest";

const { getLatestMock, getStateMock } = vi.hoisted(() => ({
  getLatestMock: vi.fn(),
  getStateMock: vi.fn(),
}));

vi.mock("./validity", () => ({
  getLatestValidPublicScanForDomain: getLatestMock,
  getPublicScanEvidenceState: getStateMock,
}));

import { getPublicOgRenderModel } from "./og-render-model";

describe("getPublicOgRenderModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns placeholder model when there is no current valid scan", async () => {
    getLatestMock.mockResolvedValueOnce(null);
    getStateMock.mockReturnValueOnce("missing");

    const model = await getPublicOgRenderModel("example.com");

    expect(getLatestMock).toHaveBeenCalledWith("example.com", {
      requireCompleted: true,
    });
    expect(model.hasCurrentProof).toBe(false);
    expect(model.scoreDisplay).toBe("—");
    expect(model.headline).toMatch(/no current public scan evidence/i);
    expect(model.scoreColor).toBe("#64748b");
  });

  it("returns score model when evidence is valid", async () => {
    getLatestMock.mockResolvedValueOnce({
      score: 82,
      criticalCount: 0,
      seriousCount: 1,
      moderateCount: 2,
      minorCount: 0,
    });
    getStateMock.mockReturnValueOnce("valid");

    const model = await getPublicOgRenderModel("example.com");

    expect(model.hasCurrentProof).toBe(true);
    expect(model.scoreDisplay).toBe("82");
    expect(model.total).toBe(3);
    expect(model.headline).toContain("3");
  });
});
