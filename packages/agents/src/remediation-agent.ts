import { prisma } from "@aros/db";
import { generateFix, validateFix } from "@aros/remediation";
import type {
  AgentContext,
  AgentResult,
  AgentStep,
  AgentEventHandler,
} from "./types";

/**
 * RemediationAgent: Autonomous agent that analyzes findings,
 * generates fixes, validates them, and decides whether to
 * auto-approve or escalate to human review.
 *
 * State machine: analyze → generate → validate → decide → finalize
 */
export class RemediationAgent {
  private onEvent?: AgentEventHandler;

  constructor(onEvent?: AgentEventHandler) {
    this.onEvent = onEvent;
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();
    const steps: AgentStep[] = [];
    let tokensUsed = 0;

    const runStep = async <T>(
      name: string,
      handler: () => Promise<T>,
    ): Promise<T> => {
      const step: AgentStep = {
        name,
        status: "running",
        startedAt: new Date(),
      };
      steps.push(step);
      this.onEvent?.({ type: "step_start", step: name });

      try {
        const output = await handler();
        step.status = "completed";
        step.output = output as any;
        step.completedAt = new Date();
        step.durationMs =
          step.completedAt.getTime() - (step.startedAt?.getTime() ?? 0);
        this.onEvent?.({ type: "step_complete", step: name, output });
        return output;
      } catch (err) {
        step.status = "failed";
        step.error = err instanceof Error ? err.message : String(err);
        step.completedAt = new Date();
        step.durationMs =
          step.completedAt.getTime() - (step.startedAt?.getTime() ?? 0);
        this.onEvent?.({ type: "step_error", step: name, error: step.error });
        throw err;
      }
    };

    try {
      // Step 1: Analyze — fetch finding and context
      const analysis = (await runStep("analyze", async () => {
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
      })) as any;

      // Step 2: Generate fix
      const fix = (await runStep("generate", async () => {
        const result = generateFix({
          ruleId: analysis.ruleId,
          elementHtml: analysis.elementHtml,
          selector: analysis.selector,
        });
        if (!result)
          throw new Error(`No fix handler for rule ${analysis.ruleId}`);
        tokensUsed += 100;
        return result;
      })) as any;

      // Step 3: Validate
      const validation = (await runStep("validate", async () => {
        return validateFix(fix.suggestedCode);
      })) as any;

      // Step 4: Decide — auto-approve or escalate
      const decision = (await runStep("decide", async () => {
        const highConfidence = fix.confidence >= 0.8;
        const passesValidation = validation.valid;
        const noWarnings = validation.warnings.length === 0;
        const lowImpact = ["MINOR", "MODERATE"].includes(analysis.impact);

        const autoApprove = highConfidence && passesValidation && noWarnings;
        const escalateToReview = !autoApprove;

        return {
          autoApprove,
          escalateToReview,
          reason: autoApprove
            ? "High confidence, valid fix, no warnings"
            : `Escalating: confidence=${fix.confidence}, valid=${passesValidation}, warnings=${validation.warnings.length}`,
        };
      })) as any;

      // Step 5: Finalize — persist suggestion
      const result = (await runStep("finalize", async () => {
        const status = decision.autoApprove
          ? "APPROVED"
          : validation.valid
            ? "VALIDATED"
            : "FAILED_VALIDATION";

        const suggestion = await prisma.remediationSuggestion.create({
          data: {
            canonicalFindingId: context.findingId!,
            type: fix.type as any,
            status,
            originalCode: analysis.elementHtml,
            suggestedCode: fix.suggestedCode,
            rationale: fix.rationale,
            confidence: fix.confidence,
            validationResult: {
              ...validation,
              agentDecision: decision,
            } as any,
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
      })) as any;

      const totalDurationMs = Date.now() - startTime;
      const agentResult: AgentResult = {
        success: true,
        steps,
        output: result,
        totalDurationMs,
        tokensUsed,
      };
      this.onEvent?.({ type: "plan_complete", result: agentResult });
      return agentResult;
    } catch (err) {
      return {
        success: false,
        steps,
        output: null,
        error: err instanceof Error ? err.message : String(err),
        totalDurationMs: Date.now() - startTime,
        tokensUsed,
      };
    }
  }
}
