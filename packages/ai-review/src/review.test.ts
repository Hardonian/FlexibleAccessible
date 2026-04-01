import { describe, it, expect } from "vitest";
import { createErrorResponse } from "./review.js";
import type { VisionAnalysisInput } from "./types.js";

describe("createErrorResponse", () => {
  const mockInput: VisionAnalysisInput = {
    screenshotBase64: "...",
    url: "https://example.com/test-page",
    pageTitle: "Test Page",
    axeViolations: [],
    domSummary: "...",
    accessibilityTreeSummary: "...",
  };

  it("should create a structured error response with a simple error message", () => {
    const error = new Error("Simple test error");
    const response = createErrorResponse(mockInput, error);

    expect(response.model_version).toBe("error");
    expect(response.overall_score).toBe(0);
    expect(response.requires_human_review).toBe(true);
    expect(response.criteria_status).toEqual([]);
    expect(response.url).toBe(mockInput.url);
    expect(response.human_review_reasons).toEqual([
      "The AI model failed to generate a review.",
      "Error: Simple test error",
    ]);
  });

  it("should correctly include the input URL in the response", () => {
    const error = new Error("URL test");
    const response = createErrorResponse(mockInput, error);

    expect(response.url).toBe("https://example.com/test-page");
  });

  it("should handle error messages with special characters", () => {
    const errorMessage = 'Error with "quotes" and \\slashes\\';
    const error = new Error(errorMessage);
    const response = createErrorResponse(mockInput, error);

    expect(response.human_review_reasons[1]).toBe(`Error: ${errorMessage}`);
  });

  it("should produce a valid ISO timestamp", () => {
    const error = new Error("Timestamp test");
    const response = createErrorResponse(mockInput, error);
    const timestamp = new Date(response.timestamp);

    expect(isNaN(timestamp.getTime())).toBe(false);
  });
});