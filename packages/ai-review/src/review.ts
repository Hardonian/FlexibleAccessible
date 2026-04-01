import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { buildVisionPrompt } from "./prompts.js";
import type { VisionAnalysisInput, VisionAnalysisOutput } from "./types.js";
import {
  AI_BLOCK_MESSAGE_PREFIX,
  AI_FAILURE_MESSAGE,
  ERROR_MODEL_VERSION,
  JSON_RESPONSE_MIME_TYPE,
  LATEST_GEMINI_MODEL,
  PNG_MIME_TYPE,
  UNKNOWN_PAGE_ID,
  UNKNOWN_REASON,
} from "./constants.js";
import { VISION_ANALYSIS_SCHEMA } from "./criteria.js";
import { VisionAnalysisOutputSchema } from "./schemas.js";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * Creates a structured error response when the AI model fails.
 * This prevents the entire pipeline from crashing.
 * @param input The original input to the analysis function.
 * @param error The error that occurred.
 * @returns A `VisionAnalysisOutput` object representing the failure.
 */
export function createErrorResponse(
  input: VisionAnalysisInput,
  error: Error,
): VisionAnalysisOutput {
  return {
    page_id: UNKNOWN_PAGE_ID,
    url: input.url,
    timestamp: new Date().toISOString(),
    model_version: ERROR_MODEL_VERSION,
    latency_ms: 0,
    overall_score: 0,
    criteria_status: [],
    requires_human_review: true,
    human_review_reasons: [
      AI_FAILURE_MESSAGE,
      `Error: ${error.message}`,
    ],
  };
}

/**
 * Analyzes a screenshot with a generative vision model, using structured JSON output.
 * Includes robust error handling for API failures and content blocking.
 * @param input The data for the vision analysis, including the screenshot.
 * @returns A `VisionAnalysisOutput` object.
 */
export async function analyzeImage(
  input: VisionAnalysisInput,
): Promise<VisionAnalysisOutput> {
  const model = genAI.getGenerativeModel({
    model: LATEST_GEMINI_MODEL,
    generationConfig: {
      response_mime_type: JSON_RESPONSE_MIME_TYPE,
      response_schema: VISION_ANALYSIS_SCHEMA,
    },
    // It's good practice to configure safety settings to avoid blocks for benign content.
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      },
    ],
  });

  const prompt = buildVisionPrompt(input);
  const imagePart = {
    inlineData: { data: input.screenshotBase64, mimeType: PNG_MIME_TYPE },
  };

  try {
    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response;

    // The response might be blocked by safety settings even if the threshold is NONE.
    if (!response.text) {
      const blockReason = response.promptFeedback?.blockReason || UNKNOWN_REASON;
      const reason = `${AI_BLOCK_MESSAGE_PREFIX}${blockReason}`;
      console.error(reason, { feedback: response.promptFeedback });
      return createErrorResponse(input, new Error(reason));
    }

    const jsonText = response.text();
    const validationResult = VisionAnalysisOutputSchema.safeParse(
      JSON.parse(jsonText),
    );

    if (!validationResult.success) {
      const parseError = new Error(
        `AI response failed Zod validation: ${validationResult.error.message}`,
      );
      console.error("Zod validation error:", validationResult.error.issues);
      return createErrorResponse(input, parseError);
    }

    return validationResult.data;
  } catch (error) {
    console.error("Error calling Generative AI model:", error);
    return createErrorResponse(input, error as Error);
  }
}