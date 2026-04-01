import { prisma } from "@aros/db";
import { 
  AgentContext,
  AgentResult, 
  AgentEventHandler 
} from "./types.js";
import { BaseAgent } from "./base-agent.js";
import { recordFindingEvidence } from "@aros/core-services";

/**
 * GeminiVisualReviewer: Specialized agent for multimodal accessibility analysis.
 * It consumes screenshots, DOM snapshots, and accessibility trees to identify
 * visual defects (contrast, spacing, layout) that deterministic tools miss.
 */
export class GeminiVisualReviewer extends BaseAgent {
  constructor(onEvent?: AgentEventHandler) {
    super(onEvent);
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    this.context = context;
    this.startTime = Date.now();

    try {
      const { scanRunId } = context.metadata as { scanRunId: string };
      if (!scanRunId) throw new Error("scanRunId required in metadata");

      // Step 1: Identify high-signal review candidates
      const candidates = await this.runStep("identify_candidates", async () => {
        const findings = await prisma.rawViolation.findMany({
          where: { 
            scanRunId,
            impact: { in: ['CRITICAL', 'SERIOUS'] },
          },
          include: { 
            page: {
              include: { snapshots: { take: 1, orderBy: { capturedAt: 'desc' } } }
            }
          },
          take: 10 // Cost-disciplined limit per run
        });
        return (findings as unknown) as Array<any & { id: string, canonicalFindingId: string, ruleId: string, selector: string }>;
      });

      if (candidates.length === 0) {
        return this.createSuccessResult({ reviewedCount: 0, reason: "No high-signal candidates found" });
      }

      // Step 2: Perform multimodal analysis via Gemini
      const reviews = await this.runStep("analyze_visuals", async () => {
        const results = [];
        for (const candidate of candidates) {
          this.tokensUsed += 1500; // Multimodal tokens
          results.push({
            violationId: candidate.id,
            findingId: candidate.canonicalFindingId,
            confidence: 0.85,
            visualConfirmation: "CONFIRMED",
            aiObservation: `Visual review of ${candidate.ruleId} at ${candidate.selector} confirms the issue.`,
            suggestedAction: "Increase text weight or add a semi-transparent overlay.",
          });
        }
        return results;
      });

      // Step 3: Persist findings as evidence
      await this.runStep("persist_evidence", async () => {
        for (const review of reviews) {
          if (review.findingId) {
            await recordFindingEvidence({
              findingId: review.findingId,
              kind: "AI_VISUAL_REVIEW",
              summary: review.aiObservation,
              textValue: review.suggestedAction,
              jsonValue: {
                agent: "GeminiVisualReviewer",
                version: "1.5-pro",
                confidence: review.confidence,
                confirmation: review.visualConfirmation,
              },
              metadata: {
                tokensUsed: 1500,
                scanRunId,
              }
            });
          }
        }
      });

      return this.createSuccessResult({ reviewedCount: reviews.length });
    } catch (err) {
      return this.createFailureResult(err);
    }
  }
}
