import {
  EnhancedGenerateContentResponse,
  GenerativeModel,
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  Part,
} from "@google/generative-ai";
import { VISION_ANALYSIS_SCHEMA } from "../criteria.js";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("The GEMINI_API_KEY environment variable is not set.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Models and API configuration
const LATEST_GEMINI_MODEL = "gemini-1.5-pro-latest";
const JSON_RESPONSE_MIME_TYPE = "application/json";

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
export async function getVisionAnalysisFromModel(
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