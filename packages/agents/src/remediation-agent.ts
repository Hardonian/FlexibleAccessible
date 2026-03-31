import { prisma, SuggestionType } from "@aros/db";
import { generateFix, validateFix } from "@aros/remediation";
import type { FixResult } from "@aros/remediation";
import type {
  AgentContext,
  AgentResult,
  AgentEventHandler,
} from "./types";
import { BaseAgent } from "./base-agent";

// Define interfaces for step outputs to improve type safety
interface AnalysisOutput {
  ruleId: string;
  impact: string;
  description: string;
  elementHtml: string;
  selector: string;
  occurrenceCount: number;
  clusterInfo: { selectorPattern: string | null; pageCount: number | null } | null;
  isClusterWide: boolean;
}

interface DecisionOutput {
  autoApprove: boolean;
  escalateToReview: boolean;
  reason: string;
}

interface FinalizeOutput {
  suggestionId: string;
  status: "APPROVED" | "VALIDATED" | "FAILED_VALIDATION";
  autoApproved: boolean;
}

/**
 * RemediationAgent: Autonomous agent that analyzes findings,
 * generates fixes, validates them, and decides whether to
 * auto-approve or escalate to human review.
 *
 * State machine: analyze → generate → validate → decide → finalize
 */
export class RemediationAgent extends BaseAgent {
  constructor(onEvent?: AgentEventHandler) {
    super(onEvent);
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    this.context = context;
    this.startTime = Date.now();

    try {
      // Step 1: Analyze — fetch finding and context
      const analysis = await this.runStep("analyze", async (): Promise<AnalysisOutput> => {
        if (!context.findingId) throw new Error("findingId required");
        const finding = await prisma.canonicalFinding.findUnique({
          where: { id: context.findingId },
          include: {
            occurrences: {
              take: 5,
              include: { page: { select: { url: true } } },
            },
            cluster: { select: { selectorPattern: true, pageCount: true } },
          },
        });
        if (!finding) throw new Error(`Finding ${context.findingId} not found`);

        return {
          ruleId: finding.ruleId,
          impact: finding.impact,
          description: finding.description,
          elementHtml: finding.occurrences[0]?.elementHtml ?? "",
          selector: finding.occurrences[0]?.selector ?? "",
          occurrenceCount: finding.occurrenceCount,
          clusterInfo: finding.cluster,
          isClusterWide: (finding.cluster?.pageCount ?? 0) > 5,
        };
      });

      // Step 2: Generate fix
      const fix = await this.runStep("generate", async (): Promise<FixResult> => {
        const result = generateFix({
          ruleId: analysis.ruleId,
          elementHtml: analysis.elementHtml,
          selector: analysis.selector,
        });
        if (!result)
          throw new Error(`No fix handler for rule ${analysis.ruleId}`);
        this.tokensUsed += 100; // Mock token usage
        return result;
      });

      // Step 3: Validate
      const validation = await this.runStep("validate", async () => {
        return validateFix(fix.suggestedCode);
      });

      // Step 4: Decide — auto-approve or escalate
      const decision = await this.runStep("decide", async (): Promise<DecisionOutput> => {
        const highConfidence = fix.confidence >= 0.8;
        const passesValidation = validation.valid;
        const noWarnings = validation.warnings.length === 0;

        const autoApprove = highConfidence && passesValidation && noWarnings;
        const escalateToReview = !autoApprove;

        return {
          autoApprove,
          escalateToReview,
          reason: autoApprove
            ? "High confidence, valid fix, no warnings"
            : `Escalating: confidence=${fix.confidence.toFixed(2)}, valid=${passesValidation}, warnings=${validation.warnings.length}`,
        };
      });

      // Step 5: Finalize — persist suggestion
      const result = await this.runStep("finalize", async (): Promise<FinalizeOutput> => {
        const status = decision.autoApprove
          ? "APPROVED"
          : validation.valid
            ? "VALIDATED"
            : "FAILED_VALIDATION";

        const suggestion = await prisma.remediationSuggestion.create({
          data: {
            canonicalFindingId: context.findingId!,
            type: fix.type as SuggestionType,
            status,
            originalCode: analysis.elementHtml,
            suggestedCode: fix.suggestedCode,
            rationale: fix.rationale,
            confidence: fix.confidence,
            validationResult: {
              ...validation,
              agentDecision: decision,
            } as any, // Prisma's JSON type requires `any` or a specific input type
          },
        });

        if (decision.escalateToReview) {
          await prisma.reviewTask.create({
            data: {
              type: "SUGGESTION_REVIEW",
              status: "PENDING",
              title: `Agent Review: ${fix.type}`,
              description: `RemediationAgent generated a ${fix.type} fix with ${Math.round(fix.confidence * 100)}% confidence. ${decision.reason}`,
            },
          });
        }

        return {
          suggestionId: suggestion.id,
          status,
          autoApproved: decision.autoApprove,
        };
      });

      return this.createSuccessResult(result);
    } catch (err) {
      return this.createFailureResult(err);
    }
  }
}
