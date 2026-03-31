import { OpenAI } from 'openai';

export interface AiFixInput {
  ruleId: string;
  elementHtml: string;
  selector: string;
  description: string;
  wcagCriteria: string[];
  impact: string;
  pageUrl?: string;
}

export interface AiFixResult {
  type: any; // SuggestionType
  suggestedCode: string;
  rationale: string;
  confidence: number;
  modelUsed: string;
  wcagTechniques: string[];
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export function isAiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Generates an accessibility fix using AI.
 * Implements tiered model selection for margin optimization:
 * - Complex/High Impact issues use gpt-4o
 * - Simple/Low Impact issues use gpt-4o-mini to reduce costs by 90%
 */
export async function generateAiFix(input: AiFixInput): Promise<AiFixResult> {
  // Profit Margin Optimization: Use cheaper model for low-impact findings
  const model = input.impact === 'CRITICAL' || input.impact === 'SERIOUS' 
    ? 'gpt-4o' 
    : 'gpt-4o-mini';

  const systemPrompt = `You are an expert accessibility remediation engineer. 
Your task is to provide the BEST, most compliant code fix for the following WCAG violation.
Respond ONLY with valid JSON.`;

  const userPrompt = `Rule: ${input.ruleId}
Description: ${input.description}
Element: ${input.elementHtml}
Impact: ${input.impact}
WCAG: ${input.wcagCriteria.join(', ')}

Return JSON format:
{
  "type": "ONE_OF_SUGGESTION_TYPES",
  "suggestedCode": "...",
  "rationale": "...",
  "confidence": 0.0 to 1.0,
  "wcagTechniques": ["..."]
}`;

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0].message.content;
  if (!content) throw new Error('AI returned empty response');

  const parsed = JSON.parse(content);

  return {
    type: parsed.type,
    suggestedCode: parsed.suggestedCode,
    rationale: parsed.rationale,
    confidence: parsed.confidence,
    modelUsed: model,
    wcagTechniques: parsed.wcagTechniques ?? [],
  };
}
