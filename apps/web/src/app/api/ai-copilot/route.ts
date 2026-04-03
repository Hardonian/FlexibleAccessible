import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/session";
import { requireCanonicalOrgAccess } from "@/lib/server-org-boundary";
import {
  getCopilotFindingContext,
  logAiCopilotUsage,
  requireAiEnabled,
} from "@/lib/ai/org-scoped-queries";
import { apiError } from "@/lib/api-utils";

export const runtime = "nodejs";

const chatSchema = z.object({
  findingId: z.string().min(1),
  organizationId: z.string().min(1),
  message: z.string().min(1).max(2000),
  mode: z.enum(["expert", "teach"]).default("expert"),
});

/**
 * POST /api/ai-copilot
 * Streaming AI chat anchored to a specific finding. Returns SSE stream.
 * Requires authenticated session + org access with findings:edit permission.
 */
export async function POST(request: Request) {
  try {
    const user = await requireSession();
    const body = await request.json();
    const parsed = chatSchema.parse(body);

    const ctx = await requireCanonicalOrgAccess(
      parsed.organizationId,
      "finding:manage",
      { requirePaid: true },
    );

    // Load finding context for RAG
    const finding = await getCopilotFindingContext(ctx, parsed.findingId);

    // Build context prompt
    const systemPrompt =
      parsed.mode === "teach"
        ? `You are an accessibility mentor helping a junior developer understand WCAG violations. Explain concepts clearly with examples. Use analogies and simple language. Always explain WHY something matters to real users.`
        : `You are an expert accessibility engineer. Provide concise, actionable answers about WCAG violations and remediation. Prefer native HTML solutions over ARIA. Be direct.`;

    const contextPrompt = `## Current Finding Context
- **Rule ID:** ${finding.ruleId}
- **Impact:** ${finding.impact}
- **Description:** ${finding.description}
- **WCAG Criteria:** ${finding.wcagCriteria.join(", ") || "Not specified"}
- **Status:** ${finding.status}
- **Occurrences:** ${finding.occurrenceCount} across ${finding.occurrences.length} sampled pages
${finding.cluster ? `- **Cluster:** ${finding.cluster.name} (${finding.cluster.findingCount} findings, ${finding.cluster.pageCount} pages)` : ""}
${finding.suggestions.length > 0 ? `- **Existing Suggestions:** ${finding.suggestions.map((s) => `${s.type} (confidence: ${s.confidence}, status: ${s.status})`).join(", ")}` : ""}

## Sample Occurrences
${finding.occurrences.map((o) => `- Page: ${o.page.url}\n  Selector: ${o.selector}\n  HTML: ${o.elementHtml.slice(0, 300)}`).join("\n")}

## User Question
${parsed.message}`;

    // Check AI entitlement
    const aiEnabled = await requireAiEnabled(ctx);
    if (!aiEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "AI_NOT_ENABLED",
            message: "AI features require a Starter plan or higher.",
          },
        },
        { status: 403 },
      );
    }

    // Select provider
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!anthropicKey && !openaiKey) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "AI_UNAVAILABLE",
            message: "No AI provider configured.",
          },
        },
        { status: 503 },
      );
    }

    // Stream response via SSE
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (anthropicKey) {
            await streamAnthropic(
              anthropicKey,
              systemPrompt,
              contextPrompt,
              controller,
              encoder,
            );
          } else {
            await streamOpenAI(
              openaiKey!,
              systemPrompt,
              contextPrompt,
              controller,
              encoder,
            );
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Stream error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: errorMsg })}\n\n`),
          );
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    // Log AI usage
    await logAiCopilotUsage(ctx, {
      userId: user.id,
      model: anthropicKey ? "claude-sonnet-4-20250514" : "gpt-4o",
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

async function streamAnthropic(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
) {
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
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "content_block_delta" && parsed.delta?.text) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ content: parsed.delta.text })}\n\n`,
              ),
            );
          }
        } catch {
          // Skip non-JSON lines
        }
      }
    }
  }
}

async function streamOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 4096,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content })}\n\n`),
            );
          }
        } catch {
          // Skip
        }
      }
    }
  }
}
