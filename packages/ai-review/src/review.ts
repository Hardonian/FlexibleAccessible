import { buildVisionPrompt, createErrorResponse } from "./prompts.js";
import type { VisionAnalysisInput, VisionAnalysisOutput } from "./types.js";
import {
  AI_BLOCK_MESSAGE_PREFIX,
  AI_FAILURE_MESSAGE,
  PNG_MIME_TYPE,
  DEBUG_PROMPT_LENGTH,
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
  const startTime = Date.now();
  const baseLogContext = {
    url: input.url,
    pageTitle: input.pageTitle,
    axeViolationsCount: input.axeViolations.length,
  };
  logger.log("Starting AI analysis", baseLogContext);

  const prompt = buildVisionPrompt(input);
  logger.debug("Generated vision prompt", {
    prompt: prompt.substring(0, DEBUG_PROMPT_LENGTH),
  });

  const imagePart = {
    inlineData: { data: input.screenshotBase64, mimeType: PNG_MIME_TYPE },
  };

  try {
    const response = await getVisionAnalysisFromModel(prompt, imagePart);
    const latency_ms = Date.now() - startTime;
    logger.log("Received response from AI model", {
      ...baseLogContext,
      latency_ms,
    });

    // The response might be blocked by safety settings even if the threshold is NONE.
    if (!response.text) {
      const blockReason = response.promptFeedback?.blockReason || UNKNOWN_REASON;
      const reason = `${AI_BLOCK_MESSAGE_PREFIX}${blockReason}`;
      logger.error(reason, { feedback: response.promptFeedback });
      return createErrorResponse(input, [AI_FAILURE_MESSAGE, `Error: ${reason}`], latency_ms);
    }

    const jsonText = response.text();
    logger.debug("Raw AI response text", { jsonText });

    let parsedJson;
    try {
      parsedJson = JSON.parse(jsonText);
      logger.log("Successfully parsed JSON from AI", baseLogContext);
    } catch (error) {
      logger.error("Error parsing JSON from AI", {
        ...baseLogContext,
        error,
      });
      return createErrorResponse(input, [
        AI_FAILURE_MESSAGE,
        `Error: Failed to parse AI response as JSON. ${(error as Error).message}`,
      ], latency_ms);
    }

    const validationResult = VisionAnalysisOutputSchema.safeParse({
      ...parsedJson,
      latency_ms,
    });

    if (!validationResult.success) {
      const errorMessage = `AI response failed Zod validation: ${validationResult.error.message}`;
      logger.warn("AI response validation failed", {
        ...baseLogContext,
        issues: validationResult.error.issues,
      });
      return createErrorResponse(input, [
        AI_FAILURE_MESSAGE,
        `Error: ${errorMessage}`,
      ], latency_ms);
    }

    logger.log("AI analysis completed successfully", {
      ...baseLogContext,
      latency_ms,
    });
    return validationResult.data;
  } catch (error) {
    const latency_ms = Date.now() - startTime;
    logger.error("Error calling Generative AI model", { ...baseLogContext, error });
    return createErrorResponse(input, [
      AI_FAILURE_MESSAGE,
      `Error: ${(error as Error).message}`,
    ], latency_ms);
  }
}