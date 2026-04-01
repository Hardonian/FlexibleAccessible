import { describe, it, expect, vi, beforeEach } from "vitest";
import { getVisionAnalysisFromModel } from "./ai.js";
import { VISION_ANALYSIS_SCHEMA } from "../criteria.js";
import type { Part } from "@google/generative-ai";

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

describe("getVisionAnalysisFromModel", () => {
  const mockPrompt = "You are an expert web accessibility auditor.";
  const mockImagePart: Part = {
    inlineData: { data: "...", mimeType: "image/png" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should correctly configure the generative model", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => "{}" },
    });

    await getVisionAnalysisFromModel(mockPrompt, mockImagePart);

    expect(mockGetGenerativeModel).toHaveBeenCalledWith({
      model: "gemini-1.5-pro-latest",
      generationConfig: {
        response_mime_type: "application/json",
        response_schema: VISION_ANALYSIS_SCHEMA,
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      ],
    });
  });

  it("should call the model with the correct prompt and image data", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => "{}" },
    });

    await getVisionAnalysisFromModel(mockPrompt, mockImagePart);

    const generateContentArgs = mockGenerateContent.mock.calls[0][0];
    expect(generateContentArgs[0]).toBe(mockPrompt);
    expect(generateContentArgs[1]).toEqual(mockImagePart);
  });

  it("should return the response from the model", async () => {
    const mockApiResponse = { text: () => '{"status":"success"}' };
    mockGenerateContent.mockResolvedValue({
      response: mockApiResponse,
    });

    const result = await getVisionAnalysisFromModel(mockPrompt, mockImagePart);

    expect(result).toEqual(mockApiResponse);
  });
});