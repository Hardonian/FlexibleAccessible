import type {
  VisionAnalysisInput,
  VisionAnalysisOutput,
  VisionProvider,
  CriterionStatus,
} from "./types.js";
import {
  buildVisionPrompt,
  buildRetryPrompt,
  computeOverallScore,
} from "./prompts.js";
import { VISION_TIMEOUT_MS } from "./types.js";

function getProvider(): VisionProvider {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  throw new Error(
    "No AI vision provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.",
  );
}

/**
 * Analyze a screenshot using a vision model.
 * Returns structured WCAG criterion assessments.
 */
export async function analyzeWithVision(
  input: VisionAnalysisInput,
  pageId: string,
): Promise<VisionAnalysisOutput> {
  const provider = getProvider();
  const startTime = Date.now();

  const prompt = buildVisionPrompt({
    url: input.url,
    pageTitle: input.pageTitle,
    axeViolations: input.axeViolations.map((v) => ({
      ruleId: v.ruleId,
      impact: v.impact ?? "unknown",
      selector: v.selector,
      description: v.description,
    })),
    accessibilityTreeSummary: input.accessibilityTreeSummary,
  });

  let rawResponse: string;
  let modelVersion: string;

  try {
    if (provider === "anthropic") {
      rawResponse = await callAnthropicVision(prompt, input.screenshotBase64);
      modelVersion = "claude-sonnet-4-20250514";
    } else {
      rawResponse = await callOpenAIVision(prompt, input.screenshotBase64);
      modelVersion = "gpt-4o";
    }
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    return createErrorResponse(
      pageId,
      input.url,
      "unknown",
      latencyMs,
      `Vision API call failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Attempt to parse the response
  let parsed: VisionAnalysisOutput | null = null;
  let parseError: string | null = null;

  try {
    parsed = parseVisionResponse(
      rawResponse,
      pageId,
      input.url,
      modelVersion,
      Date.now() - startTime,
    );
  } catch (err) {
    parseError = err instanceof Error ? err.message : String(err);
  }

  // Retry with simplified prompt if first parse failed
  if (!parsed) {
    console.warn(
      `[VisionAnalyzer] Parse failed for ${input.url}: ${parseError}. Retrying...`,
    );

    try {
      const retryPrompt = buildRetryPrompt({
        url: input.url,
        pageTitle: input.pageTitle,
      });

      let retryRaw: string;
      if (provider === "anthropic") {
        retryRaw = await callAnthropicVision(
          retryPrompt,
          input.screenshotBase64,
        );
      } else {
        retryRaw = await callOpenAIVision(retryPrompt, input.screenshotBase64);
      }

      parsed = parseVisionResponse(
        retryRaw,
        pageId,
        input.url,
        `${modelVersion}-retry`,
        Date.now() - startTime,
      );
    } catch (retryErr) {
      // Both attempts failed
    }
  }

  if (!parsed) {
    return createErrorResponse(
      pageId,
      input.url,
      modelVersion,
      Date.now() - startTime,
      `Vision model returned unparseable response after 2 attempts: ${parseError}`,
    );
  }

  // Compute overall score from criteria if not provided or invalid
  if (parsed.overall_score < 0 || parsed.overall_score > 100) {
    parsed.overall_score = computeOverallScore(parsed.criteria_status);
  }

  return parsed;
}

/**
 * Call Anthropic Claude vision API with a screenshot.
 */
async function callAnthropicVision(
  prompt: string,
  screenshotBase64: string,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        temperature: 0.1,
        system:
          "You are an accessibility expert. Respond ONLY with valid JSON matching the requested schema. No markdown fences.",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: screenshotBase64,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(
        `Anthropic API error ${response.status}: ${err.slice(0, 200)}`,
      );
    }

    const data = (await response.json()) as {
      content: Array<{ text: string }>;
    };
    return data.content[0]?.text ?? "";
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Call OpenAI GPT-4o vision API with a screenshot.
 */
async function callOpenAIVision(
  prompt: string,
  screenshotBase64: string,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 4096,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              "You are an accessibility expert. Respond ONLY with valid JSON matching the requested schema. No markdown fences.",
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${screenshotBase64}`,
                  detail: "high",
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(
        `OpenAI API error ${response.status}: ${err.slice(0, 200)}`,
      );
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse a vision model response into structured output.
 */
function parseVisionResponse(
  raw: string,
  pageId: string,
  url: string,
  modelVersion: string,
  latencyMs: number,
): VisionAnalysisOutput {
  let jsonStr = raw.trim();

  // Strip markdown fences if present
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  // Try to find JSON object in the response
  const jsonStart = jsonStr.indexOf("{");
  const jsonEnd = jsonStr.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`JSON parse failed: ${jsonStr.slice(0, 200)}`);
  }

  // Validate required fields
  if (!Array.isArray(parsed.criteria_status)) {
    throw new Error("Missing or invalid criteria_status array");
  }

  // Normalize and validate criteria
  const criteriaStatus: CriterionStatus[] = (
    parsed.criteria_status as any[]
  ).map((c) => {
    const rawLevel = String(c.level ?? "AA");
    const level: "A" | "AA" | "AAA" =
      rawLevel === "AAA" ? "AAA" : rawLevel === "AA" ? "AA" : "A";
    return {
      criterion_id: String(c.criterion_id ?? ""),
      criterion_name: String(c.criterion_name ?? ""),
      level,
      status: ["pass", "fail", "partial", "not_applicable", "uncertain"].includes(
        c.status,
      )
        ? c.status
        : "uncertain",
      confidence: Math.max(0, Math.min(1, Number(c.confidence ?? 0.5))),
      issues: Array.isArray(c.issues)
        ? c.issues.map((i: any) => ({
            description: String(i.description ?? ""),
            severity: ["critical", "serious", "moderate", "minor"].includes(
              i.severity,
            )
              ? i.severity
              : "moderate",
            selector: String(i.selector ?? ""),
            element_description: i.element_description
              ? String(i.element_description)
              : undefined,
            suggested_fix: i.suggested_fix ? String(i.suggested_fix) : undefined,
            evidence: i.evidence ? String(i.evidence) : undefined,
          }))
        : [],
    };
  });
      : [],
  }));

  const overallScore = Number(parsed.overall_score ?? 50);
  const requiresHumanReview = Boolean(parsed.requires_human_review);
  const humanReviewReasons: string[] = Array.isArray(
    parsed.human_review_reasons,
  )
    ? parsed.human_review_reasons.map(String)
    : [];

  return {
    page_id: pageId,
    url,
    timestamp: new Date().toISOString(),
    model_version: modelVersion,
    latency_ms: latencyMs,
    overall_score: Math.max(0, Math.min(100, overallScore)),
    criteria_status: criteriaStatus,
    requires_human_review: requiresHumanReview,
    human_review_reasons: humanReviewReasons,
  };
}

/**
 * Create an error response when vision analysis fails completely.
 */
function createErrorResponse(
  pageId: string,
  url: string,
  modelVersion: string,
  latencyMs: number,
  error: string,
): VisionAnalysisOutput {
  return {
    page_id: pageId,
    url,
    timestamp: new Date().toISOString(),
    model_version: modelVersion,
    latency_ms: latencyMs,
    overall_score: -1,
    criteria_status: [],
    requires_human_review: true,
    human_review_reasons: [error],
  };
}
