import type { SuggestionType } from "@aros/db";

export interface AiFixInput {
  ruleId: string;
  elementHtml: string;
  selector: string;
  description: string;
  wcagCriteria: string[];
  impact: string;
  surroundingDom?: string;
  componentPattern?: string;
  pageUrl?: string;
}

export interface AiFixResult {
  type: SuggestionType;
  suggestedCode: string;
  rationale: string;
  confidence: number;
  wcagTechniques: string[];
  modelUsed: string;
}

export type AiProvider = "anthropic" | "openai";

const SUGGESTION_TYPE_MAP: Record<string, SuggestionType> = {
  ALT_TEXT: "ALT_TEXT",
  BUTTON_LABEL: "BUTTON_LABEL",
  LINK_TEXT: "LINK_TEXT",
  FORM_LABEL: "FORM_LABEL",
  HEADING_FIX: "HEADING_FIX",
  SEMANTIC_HTML: "SEMANTIC_HTML",
  ARIA_CLEANUP: "ARIA_CLEANUP",
  COLOR_CONTRAST: "COLOR_CONTRAST",
  CUSTOM_SNIPPET: "CUSTOM_SNIPPET",
};

function getProvider(): AiProvider {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  throw new Error(
    "No AI provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.",
  );
}

function buildPrompt(input: AiFixInput): string {
  return `You are an expert web accessibility engineer specializing in WCAG 2.2 compliance.
Your task is to generate a code fix for an accessibility violation.

## Violation Details
- **Rule ID:** ${input.ruleId}
- **Impact:** ${input.impact}
- **Description:** ${input.description}
- **WCAG Criteria:** ${input.wcagCriteria.join(", ") || "Not specified"}
- **CSS Selector:** ${input.selector}
- **Page URL:** ${input.pageUrl || "Unknown"}

## Violating Element
\`\`\`html
${input.elementHtml}
\`\`\`

${input.surroundingDom ? `## Surrounding DOM Context\n\`\`\`html\n${input.surroundingDom}\n\`\`\`\n` : ""}
${input.componentPattern ? `## Component Pattern (this issue appears across multiple pages)\n\`\`\`html\n${input.componentPattern}\n\`\`\`\n` : ""}

## Requirements
1. Generate the MINIMAL fix that resolves the violation
2. Prefer native HTML semantics over ARIA attributes
3. Preserve existing functionality and styling hooks (classes, data attributes)
4. Do NOT add JavaScript, event handlers, or script tags
5. Do NOT use innerHTML, eval, or document.write
6. Provide WCAG technique references where applicable

## Response Format
Respond with ONLY a JSON object (no markdown, no explanation outside JSON):
{
  "type": "one of: ALT_TEXT, BUTTON_LABEL, LINK_TEXT, FORM_LABEL, HEADING_FIX, SEMANTIC_HTML, ARIA_CLEANUP, COLOR_CONTRAST, CUSTOM_SNIPPET",
  "suggestedCode": "the fixed HTML code",
  "rationale": "2-3 sentence explanation of why this fix works and how it addresses the WCAG criterion",
  "confidence": 0.0 to 1.0,
  "wcagTechniques": ["G73", "H67", ...]
}`;
}

async function callAnthropic(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      temperature: 0.2,
      system:
        "You are an accessibility remediation expert. Respond ONLY with valid JSON.",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as { content: Array<{ text: string }> };
  return data.content[0]?.text ?? "";
}

async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 2048,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are an accessibility remediation expert. Respond ONLY with valid JSON.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices[0]?.message?.content ?? "";
}

function parseAiResponse(raw: string, provider: AiProvider): AiFixResult {
  let jsonStr = raw.trim();
  // Strip markdown fences if present
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(
      `Failed to parse AI response as JSON: ${jsonStr.slice(0, 200)}`,
    );
  }

  const type =
    SUGGESTION_TYPE_MAP[String(parsed.type ?? "")] ?? "CUSTOM_SNIPPET";
  const suggestedCode = String(parsed.suggestedCode ?? "");
  const rationale = String(parsed.rationale ?? "No rationale provided.");
  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5)));
  const wcagTechniques = Array.isArray(parsed.wcagTechniques)
    ? parsed.wcagTechniques.map(String)
    : [];

  if (!suggestedCode) {
    throw new Error("AI returned empty suggestedCode");
  }

  return {
    type,
    suggestedCode,
    rationale,
    confidence,
    wcagTechniques,
    modelUsed: provider === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o",
  };
}

export async function generateAiFix(input: AiFixInput): Promise<AiFixResult> {
  const provider = getProvider();
  const prompt = buildPrompt(input);

  const raw =
    provider === "anthropic"
      ? await callAnthropic(prompt)
      : await callOpenAI(prompt);

  return parseAiResponse(raw, provider);
}

export function isAiConfigured(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}
