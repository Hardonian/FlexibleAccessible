import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  GenerativeModel,
  Part,
  EnhancedGenerateContentResponse,
} from "@google/generative-ai";
import { buildVisionPrompt, createErrorResponse } from "./prompts.js";
import type { VisionAnalysisInput, VisionAnalysisOutput } from "./types.js";
import {
  AI_BLOCK_MESSAGE_PREFIX,
  AI_FAILURE_MESSAGE,
  JSON_RESPONSE_MIME_TYPE,
  LATEST_GEMINI_MODEL,
  PNG_MIME_TYPE,
  UNKNOWN_REASON,
} from "./constants.js";
import { VISION_ANALYSIS_SCHEMA } from "./criteria.js";
import { VisionAnalysisOutputSchema } from "./schemas.js";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("The GEMINI_API_KEY environment variable is not set.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Safety settings to avoid blocking for benign content.
 */
const SAFETY_SETTINGS = [
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
];

/**
 * Calls the generative AI model with the given prompt and image.
 * @param prompt The text prompt for the model.
 * @param imagePart The image part for the model.
 * @returns The response from the model.
 */
async function getVisionAnalysisFromModel(
  prompt: string,
  imagePart: Part,
): Promise<EnhancedGenerateContentResponse> {
  const model = genAI.getGenerativeModel({
    model: LATEST_GEMINI_MODEL,
    generationConfig: {
      response_mime_type: JSON_RESPONSE_MIME_TYPE,
      response_schema: VISION_ANALYSIS_SCHEMA,
    },
    // It's good practice to configure safety settings to avoid blocks for benign content.
    safetySettings: SAFETY_SETTINGS,
  });

  const result = await model.generateContent([prompt, imagePart]);
  return result.response;
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
  const prompt = buildVisionPrompt(input);
  const imagePart = {
    inlineData: { data: input.screenshotBase64, mimeType: PNG_MIME_TYPE },
  };

  try {
    const response = await getVisionAnalysisFromModel(prompt, imagePart);

    // The response might be blocked by safety settings even if the threshold is NONE.
    if (!response.text) {
      const blockReason = response.promptFeedback?.blockReason || UNKNOWN_REASON;
      const reason = `${AI_BLOCK_MESSAGE_PREFIX}${blockReason}`;
      console.error(reason, { feedback: response.promptFeedback });
      return createErrorResponse(input, [AI_FAILURE_MESSAGE, `Error: ${reason}`]);
    }

    const jsonText = response.text();
    let parsedJson;
    try {
      parsedJson = JSON.parse(jsonText);
    } catch (error) {
      console.error("Error parsing AI response JSON:", error);
      return createErrorResponse(input, [
        AI_FAILURE_MESSAGE,
        `Error: Failed to parse AI response as JSON. ${(error as Error).message}`,
      ]);
    }

    const validationResult = VisionAnalysisOutputSchema.safeParse(parsedJson);

    if (!validationResult.success) {
      const errorMessage = `AI response failed Zod validation: ${validationResult.error.message}`;
      console.error("Zod validation error:", validationResult.error.issues);
      return createErrorResponse(input, [
        AI_FAILURE_MESSAGE,
        `Error: ${errorMessage}`,
      ]);
    }

    return validationResult.data;
  } catch (error) {
    console.error("Error calling Generative AI model:", error);
    return createErrorResponse(input, [
      AI_FAILURE_MESSAGE,
      `Error: ${(error as Error).message}`,
    ]);
  }
}