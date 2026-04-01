import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Part } from "@google/generative-ai";
import { VISION_TIMEOUT_MS } from "../constants.js";

interface VisionResponse {
  text: () => string;
  promptFeedback?: {
    blockReason?: string;
  } | null;
}

interface GenerativeModel {
  generateContent: (
    ...args: unknown[]
  ) => Promise<{ response: VisionResponse }>;
}

interface GenerativeAI {
  getGenerativeModel: (config: Record<string, unknown>) => GenerativeModel;
}

function createGenerativeModel(): GenerativeAI {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set",
    );
  }
  return new GoogleGenerativeAI(apiKey) as unknown as GenerativeAI;
}

/**
 * Get vision analysis from the Gemini model.
 * Returns a structured response with accessibility assessment.
 */
export async function getVisionAnalysisFromModel(
  prompt: string,
  imagePart: Part,
): Promise<VisionResponse> {
  const model = createGenerativeModel();

  const safetySettings = [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
    {
      category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      threshold: "BLOCK_NONE",
    },
    {
      category: "HARM_CATEGORY_DANGEROUS_CONTENT",
      threshold: "BLOCK_NONE",
    },
  ];

  const generativeModel = model.getGenerativeModel({
    model: "gemini-1.5-pro-latest",
    generationConfig: {
      response_mime_type: "application/json",
      response_schema: {
        type: "object",
        required: [
          "page_id",
          "url",
          "overall_score",
          "criteria_status",
          "requires_human_review",
          "human_review_reasons",
        ],
        properties: {
          page_id: { type: "string" },
          url: { type: "string" },
          overall_score: { type: "number" },
          criteria_status: { type: "array" },
          requires_human_review: { type: "boolean" },
          human_review_reasons: { type: "array" },
        },
      },
    },
    safetySettings,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);

  try {
    const result = await generativeModel.generateContent(prompt, imagePart);
    const response = result.response;

    return {
      text: () => response.text(),
      promptFeedback: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}
