import { buildVisionPrompt, createErrorResponse } from "./prompts.js";
import type { VisionAnalysisInput, VisionAnalysisOutput } from "./types.js";
import {
  AI_BLOCK_MESSAGE_PREFIX,
  AI_FAILURE_MESSAGE,
  PNG_MIME_TYPE,
  UNKNOWN_REASON,
} from "./constants.js";
import { VisionAnalysisOutputSchema } from "./schemas.js";
import { getVisionAnalysisFromModel } from "./services/ai.js";
import { logger } from "./logger.js";

/**
 * Analyzes a screenshot with a generative vision model, using structured JSON output.
 * Includes robust error handling for API failures and content blocking.
 * @param input The data for the vision analysis, including the screenshot.
 * @returns A `VisionAnalysisOutput` object.
 */
export async function analyzeImage(
  input: VisionAnalysisInput,
): Promise<VisionAnalysisOutput> {
  logger.log("Starting AI analysis", { url: input.url });
  const prompt = buildVisionPrompt(input);
  const imagePart = {
    inlineData: { data: input.screenshotBase64, mimeType: PNG_MIME_TYPE },
  };

  try {
    const response = await getVisionAnalysisFromModel(prompt, imagePart);
    logger.log("Received response from AI model", { url: input.url });

    // The response might be blocked by safety settings even if the threshold is NONE.
    if (!response.text) {
      const blockReason = response.promptFeedback?.blockReason || UNKNOWN_REASON;
      const reason = `${AI_BLOCK_MESSAGE_PREFIX}${blockReason}`;
      logger.error(reason, { feedback: response.promptFeedback });
      return createErrorResponse(input, [AI_FAILURE_MESSAGE, `Error: ${reason}`]);
    }

    const jsonText = response.text();
    let parsedJson;
    try {
      parsedJson = JSON.parse(jsonText);
      logger.log("Successfully parsed JSON from AI", { url: input.url });
    } catch (error) {
      logger.error("Error parsing JSON from AI", { url: input.url, error });
      return createErrorResponse(input, [
        AI_FAILURE_MESSAGE,
        `Error: Failed to parse AI response as JSON. ${(error as Error).message}`,
      ]);
    }

    const validationResult = VisionAnalysisOutputSchema.safeParse(parsedJson);

    if (!validationResult.success) {
      const errorMessage = `AI response failed Zod validation: ${validationResult.error.message}`;
      logger.error("Zod validation error", {
        url: input.url,
        issues: validationResult.error.issues,
      });
      return createErrorResponse(input, [
        AI_FAILURE_MESSAGE,
        `Error: ${errorMessage}`,
      ]);
    }

    logger.log("AI analysis completed successfully", { url: input.url });
    return validationResult.data;
  } catch (error) {
    logger.error("Error calling Generative AI model", { url: input.url, error });
    return createErrorResponse(input, [
      AI_FAILURE_MESSAGE,
      `Error: ${(error as Error).message}`,
    ]);
  }
}