import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyzeImage } from "./review.js";
import { createErrorResponse } from "./prompts.js";
import type { VisionAnalysisInput, VisionAnalysisOutput } from "./types.js";

// Mock the AI service
const { mockGetVisionAnalysisFromModel } = vi.hoisted(() => ({
  mockGetVisionAnalysisFromModel: vi.fn(),
}));

// Mock the logger
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("./services/ai.js", () => ({
  getVisionAnalysisFromModel: mockGetVisionAnalysisFromModel,
}));

vi.mock("./logger.js", () => ({
  logger: mockLogger,
}));

vi.mock("../constants.js", () => ({
  VISION_TIMEOUT_MS: 30000,
  PNG_MIME_TYPE: "image/png",
}));

describe("createErrorResponse", () => {
  const mockInput: VisionAnalysisInput = {
    screenshotBase64: "...",
    url: "https://example.com/test-page",
    pageTitle: "Test Page",
    axeViolations: [],
    domSummary: "...",
    accessibilityTreeSummary: "...",
  };

  it("should create a structured error response with the provided reasons", () => {
    const reasons = ["Reason 1", "Reason 2"];
    const response = createErrorResponse(mockInput, reasons);

    expect(response.model_version).toBe("error");
    expect(response.overall_score).toBe(0);
    expect(response.requires_human_review).toBe(true);
    expect(response.criteria_status).toEqual([]);
    expect(response.url).toBe(mockInput.url);
    expect(response.human_review_reasons).toEqual(reasons);
  });

  it("should correctly include the input URL in the response", () => {
    const response = createErrorResponse(mockInput, ["URL test"]);

    expect(response.url).toBe("https://example.com/test-page");
  });

  it("should handle error messages with special characters", () => {
    const errorMessage = 'Error with "quotes" and \\slashes\\';
    const response = createErrorResponse(mockInput, [errorMessage]);

    expect(response.human_review_reasons[0]).toBe(errorMessage);
  });

  it("should produce a valid ISO timestamp", () => {
    const response = createErrorResponse(mockInput, ["Timestamp test"]);
    const timestamp = new Date(response.timestamp);

    expect(isNaN(timestamp.getTime())).toBe(false);
  });
});

describe("analyzeImage", () => {
  const mockInput: VisionAnalysisInput = {
    screenshotBase64: "...",
    url: "https://example.com/test-page",
    pageTitle: "Test Page",
    axeViolations: [],
    domSummary: "...",
    accessibilityTreeSummary: "...",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    mockGetVisionAnalysisFromModel.mockClear();
    mockLogger.log.mockClear();
    mockLogger.error.mockClear();
  });

  const createMockApiResponse = (
    overrides: Partial<VisionAnalysisOutput> = {},
  ): VisionAnalysisOutput => ({
    page_id: "123",
    url: "https://example.com/test-page",
    timestamp: new Date().toISOString(),
    model_version: "gemini-1.5-pro-test",
    latency_ms: 500,
    overall_score: 95,
    criteria_status: [],
    requires_human_review: false,
    human_review_reasons: [],
    ...overrides,
  });

  it("should return a valid analysis on success", async () => {
    const mockApiResponse = createMockApiResponse();

    mockGetVisionAnalysisFromModel.mockResolvedValue({
      text: () => JSON.stringify(mockApiResponse),
    });

    const result = await analyzeImage(mockInput);

    expect(result.model_version).toBe("gemini-1.5-pro-test");
    expect(result.overall_score).toBe(95);
    expect(mockGetVisionAnalysisFromModel).toHaveBeenCalledOnce();
  });

  it("should return a structured error when the API call fails", async () => {
    const apiError = new Error("API Failure");
    mockGetVisionAnalysisFromModel.mockRejectedValue(apiError);

    const result = await analyzeImage(mockInput);

    expect(result.model_version).toBe("error");
    expect(result.requires_human_review).toBe(true);
    expect(result.human_review_reasons).toContain(
      "The AI model failed to generate a review.",
    );
    expect(
      result.human_review_reasons.some((r) => r.includes("API Failure")),
    ).toBe(true);
    expect(result.url).toBe(mockInput.url);
  });

  it("should return a structured error when the response is blocked for safety reasons", async () => {
    mockGetVisionAnalysisFromModel.mockResolvedValue({
      text: () => "", // Empty text indicates blocking
      promptFeedback: {
        blockReason: "SAFETY",
      },
    });

    const result = await analyzeImage(mockInput);

    expect(result.model_version).toBe("error");
    expect(result.requires_human_review).toBe(true);
    expect(result.human_review_reasons.some((r) => r.includes("SAFETY"))).toBe(
      true,
    );
  });

  it("should handle blocked responses with unknown reasons", async () => {
    mockGetVisionAnalysisFromModel.mockResolvedValue({
      text: () => "",
      promptFeedback: null,
    });

    const result = await analyzeImage(mockInput);
    expect(result.model_version).toBe("error");
    expect(result.human_review_reasons.some((r) => r.includes("Unknown"))).toBe(
      true,
    );
  });

  it("should return a structured error when the AI response is not valid JSON", async () => {
    mockGetVisionAnalysisFromModel.mockResolvedValue({
      text: () =>
        '{"page_id": "123", "url": "https://example.com", "invalid_json"',
    });

    const result = await analyzeImage(mockInput);
    expect(result.model_version).toBe("error");
    expect(result.human_review_reasons.some((r) => r.includes("JSON"))).toBe(
      true,
    );
  });

  it("should return a structured error when the AI response fails Zod validation", async () => {
    const malformedApiResponse = {
      page_id: "123",
      url: "https://example.com/test-page",
      // Missing several required fields like 'timestamp', 'model_version', etc.
    };

    mockGetVisionAnalysisFromModel.mockResolvedValue({
      text: () => JSON.stringify(malformedApiResponse),
    });

    const result = await analyzeImage(mockInput);
    expect(result.model_version).toBe("error");
    expect(result.requires_human_review).toBe(true);
    expect(result.human_review_reasons.some((r) => r.includes("Zod"))).toBe(
      true,
    );
  });
});
