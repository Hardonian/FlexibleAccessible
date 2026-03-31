import { Job, Queue } from "bullmq";
import crypto from "crypto";
import { prisma } from "@aros/db";
import type { SuggestionType } from "@aros/db";
import { generateFix, validateFix } from "@aros/remediation";
import { checkAiEntitlement, logAiUsage, getRedisClient } from "@aros/shared";
import { generateAiFix, isAiConfigured, type AiFixInput } from "./ai-client";

interface RemediationJobData {
  findingId: string;
  clusterId?: string;
  siteId: string;
}

interface SuggestionResult {
  type: SuggestionType;
  suggestedCode: string;
  rationale: string;
  confidence: number;
  modelUsed?: string;
  wcagTechniques?: string[];
}

export async function handleRemediationJob(job: Job<RemediationJobData>) {
  const { findingId, clusterId } = job.data;

  console.log(`[Remediation] Generating suggestion for finding ${findingId}`);

  const finding = await prisma.canonicalFinding.findUnique({
    where: { id: findingId },
    include: {
      occurrences: {
        take: 5,
        include: { page: { select: { url: true } } },
      },
      site: {
        include: {
          workspace: {
            select: { organizationId: true },
          },
        },
      },
    },
  });

  if (!finding) {
    console.warn(`[Remediation] Finding ${findingId} not found`);
    return;
  }

  const organizationId = finding.site.workspace.organizationId;

  // Check AI entitlement for monetization
  const entitlement = await checkAiEntitlement(prisma, organizationId);
  if (!entitlement.allowed) {
    console.warn(
      `[Remediation] AI Usage blocked for org ${organizationId}: ${entitlement.reason}`,
    );
    return;
  }

  const firstOccurrence = finding.occurrences[0];
  if (!firstOccurrence) {
    console.warn(`[Remediation] No occurrences for finding ${findingId}`);
    return;
  }

  const elementHtml = firstOccurrence.elementHtml;
  const ruleId = finding.ruleId;

  let suggestion: SuggestionResult | null = null;
  let generationMethod: "AI" | "RULE_BASED" = "RULE_BASED";

  // ─── PROFITABILITY LAYER: DEDUPLICATION CACHE ─────────────────────
  const redis = getRedisClient();
  const cacheKey = `ai:suggestion:${crypto.createHash('sha256').update(`${ruleId}:${elementHtml}`).digest('hex')}`;
  
  const cachedSuggestion = await redis.get(cacheKey);
  if (cachedSuggestion) {
    const parsed = JSON.parse(cachedSuggestion);
    console.log(`[Remediation] Cache Hit for ${ruleId} (Confidence: ${parsed.confidence})`);
    suggestion = parsed;
    generationMethod = "AI"; // Treated as AI even if it's from cache
  }

  // Try AI-powered generation if no cache hit
  if (!suggestion && isAiConfigured()) {
    try {
      const aiInput: AiFixInput = {
        ruleId,
        elementHtml,
        selector: firstOccurrence.selector ?? "",
        description: finding.description,
        wcagCriteria: (finding.wcagTags as string[]) ?? [],
        impact: finding.impact,
        pageUrl: firstOccurrence.page?.url,
      };

      const aiResult = await generateAiFix(aiInput);
      suggestion = {
        type: aiResult.type,
        suggestedCode: aiResult.suggestedCode,
        rationale: aiResult.rationale,
        confidence: aiResult.confidence,
        modelUsed: aiResult.modelUsed,
        wcagTechniques: aiResult.wcagTechniques,
      };
      generationMethod = "AI";
      
      // Cache the result for 24 hours if confidence is high
      if (suggestion.confidence > 0.8) {
        await redis.setex(cacheKey, 86400, JSON.stringify(suggestion));
      }

      console.log(
        `[Remediation] AI-generated suggestion for ${ruleId} (confidence: ${aiResult.confidence})`,
      );
    } catch (err) {
      console.warn(
        `[Remediation] AI generation failed, falling back to rules:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // Fallback to rule-based generation
  if (!suggestion) {
    const ruleResult = generateFix({
      ruleId,
      elementHtml,
      selector: firstOccurrence.selector ?? "",
    });
    if (ruleResult) {
      suggestion = {
        type: ruleResult.type as SuggestionType,
        suggestedCode: ruleResult.suggestedCode,
        rationale: ruleResult.rationale,
        confidence: ruleResult.confidence,
        modelUsed: "rule-based-v1",
      };
      generationMethod = "RULE_BASED";
    }
  }

  if (!suggestion) {
    console.log(`[Remediation] No suggestion generated for ${ruleId}`);
    return;
  }

  // Validate the suggestion
  const validation = validateFix(suggestion.suggestedCode);

  const status = validation.valid ? "VALIDATED" : "FAILED_VALIDATION";

  await prisma.remediationSuggestion.create({
    data: {
      canonicalFindingId: findingId,
      clusterId: clusterId ?? null,
      type: suggestion.type,
      status,
      originalCode: elementHtml,
      suggestedCode: suggestion.suggestedCode,
      rationale: suggestion.rationale,
      confidence: suggestion.confidence,
      validationResult: {
        ...validation,
        generationMethod,
        modelUsed: suggestion.modelUsed,
        wcagTechniques: suggestion.wcagTechniques ?? [],
      } as object,
    },
  });

  // Log AI usage for billing
  const inputTokens = Math.ceil(elementHtml.length / 4);
  const outputTokens = Math.ceil(suggestion.suggestedCode.length / 4);

  await logAiUsage(prisma, {
    organizationId,
    model: suggestion.modelUsed ?? generationMethod.toLowerCase(),
    promptTokens: inputTokens,
    completionTokens: outputTokens,
    purpose: "REMEDIATION_SUGGESTION",
  });

  // If confidence is below threshold or validation failed, create a review task
  if (suggestion.confidence < 0.7 || !validation.valid) {
    await prisma.reviewTask.create({
      data: {
        type: "SUGGESTION_REVIEW",
        status: "PENDING",
        title: `Review: ${suggestion.type.toLowerCase().replace("_", " ")} suggestion`,
        description: [
          `${generationMethod === "AI" ? "AI" : "Rule"}-generated suggestion for "${finding.description}"`,
          `Confidence: ${Math.round(suggestion.confidence * 100)}%`,
          `Method: ${generationMethod}${suggestion.modelUsed ? ` (${suggestion.modelUsed})` : ""}`,
          validation.errors.length > 0
            ? `Errors: ${validation.errors.join("; ")}`
            : "",
          validation.warnings.length > 0
            ? `Warnings: ${validation.warnings.join("; ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });
  }

  console.log(
    `[Remediation] Suggestion created for finding ${findingId} (${status}, ${generationMethod}, confidence: ${suggestion.confidence})`,
  );
}
