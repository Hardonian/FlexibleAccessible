import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Part } from "@google/generative-ai";

// Set environment variable before importing
process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-api-key";

// Create mocks
const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn(() => ({
  generateContent: mockGenerateContent,
}));

// Mock @google/generative-ai before importing the module
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
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

// Import after mocking
import { getVisionAnalysisFromModel } from "./ai.js";

describe("getVisionAnalysisFromModel", () => {
  const mockPrompt = "You are an expert web accessibility auditor.";
  const mockImagePart: Part = {
    inlineData: { data: "...", mimeType: "image/png" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGenerativeModel.mockReturnValue({
      generateContent: mockGenerateContent,
    } as any);
  });

  it("should correctly configure the generative model", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => "{}" },
    });

    await getVisionAnalysisFromModel(mockPrompt, mockImagePart);

    expect(mockGetGenerativeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-1.5-pro-latest",
      }),
    );
  });

  it("should call the model with the correct prompt and image data", async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => "{}" },
    });

    await getVisionAnalysisFromModel(mockPrompt, mockImagePart);

    expect(mockGenerateContent).toHaveBeenCalledWith(mockPrompt, mockImagePart);
  });

  it("should return the response from the model", async () => {
    const mockApiResponse = { text: () => '{"status":"success"}' };
    mockGenerateContent.mockResolvedValue({
      response: mockApiResponse,
    });

    const result = await getVisionAnalysisFromModel(mockPrompt, mockImagePart);

    expect(result.text()).toBe('{"status":"success"}');
  });
});
