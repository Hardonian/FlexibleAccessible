import { describe, it, expect, vi, beforeEach } from "vitest";
import { createErrorResponse, analyzeImage } from "./review.js";
import type { VisionAnalysisInput, VisionAnalysisOutput } from "./types.js";

// Mock the Generative AI SDK
const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn(() => ({
  generateContent: mockGenerateContent,
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
  // Export enums used by the module under test
  HarmCategory: {
    HARM_CATEGORY_HARASSMENT: "HARM_CATEGORY_HARASSMENT",
    HARM_CATEGORY_HATE_SPEECH: "HARM_CATEGORY_HATE_SPEECH",
    HARM_CATEGORY_SEXUALLY_EXPLICIT: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    HARM_CATEGORY_DANGEROUS_CONTENT: "HARM_CATEGORY_DANGEROUS_CONTENT",
  },
  HarmBlockThreshold: {
    BLOCK_NONE: "BLOCK_NONE",
  },
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
  });

  it("should return a valid analysis on success", async () => {
    const mockApiResponse: VisionAnalysisOutput = {
      page_id: "123",
      url: "https://example.com/test-page",
      timestamp: new Date().toISOString(),
      model_version: "gemini-1.5-pro-test",
      latency_ms: 500,
      overall_score: 95,
      criteria_status: [],
      requires_human_review: false,
      human_review_reasons: [],
    };

    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify(mockApiResponse),
      },
    });

    const result = await analyzeImage(mockInput);

    expect(result).toEqual(mockApiResponse);
    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gemini-1.5-pro-latest" }),
    );
    expect(mockGenerateContent).toHaveBeenCalledOnce();
  });

  it("should return a structured error when the API call fails", async () => {
    const apiError = new Error("API Failure");
    mockGenerateContent.mockRejectedValue(apiError);

    const result = await analyzeImage(mockInput);

    expect(result.model_version).toBe("error");
    expect(result.requires_human_review).toBe(true);
    expect(result.human_review_reasons).toEqual([
      "The AI model failed to generate a review.",
      "Error: API Failure",
    ]);
    expect(result.url).toBe(mockInput.url);
  });

  it("should return a structured error when the response is blocked for safety reasons", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => "", // Empty text indicates blocking
        promptFeedback: {
          blockReason: "SAFETY",
        },
      },
    });

    const result = await analyzeImage(mockInput);

    expect(result.model_version).toBe("error");
    expect(result.requires_human_review).toBe(true);
    expect(result.human_review_reasons).toEqual([
      "The AI model failed to generate a review.",
      "Error: AI response was blocked. Reason: SAFETY",
    ]);
  });

  it("should handle blocked responses with unknown reasons", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => "", promptFeedback: null },
    });

    const result = await analyzeImage(mockInput);
    expect(result.human_review_reasons).toEqual([
      "The AI model failed to generate a review.",
      "Error: AI response was blocked. Reason: Unknown",
    ]);
  });

  it("should return a structured error when the AI response is not valid JSON", async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => '{"page_id": "123", "url": "https://example.com", "invalid_json"',
      },
    });

    const result = await analyzeImage(mockInput);
    expect(result.model_version).toBe("error");
    expect(result.human_review_reasons[1]).toContain(
      "Error: Failed to parse AI response as JSON.",
    );
  });

  it("should return a structured error when the AI response fails Zod validation", async () => {
    const malformedApiResponse = {
      page_id: "123",
      url: "https://example.com/test-page",
      // Missing several required fields like 'timestamp', 'model_version', etc.
    };

    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => JSON.stringify(malformedApiResponse),
      },
    });

    const result = await analyzeImage(mockInput);
    expect(result.model_version).toBe("error");
    expect(result.requires_human_review).toBe(true);
    expect(result.human_review_reasons[1]).toContain("Error: AI response failed Zod validation");
  });
});