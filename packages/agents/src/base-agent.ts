import { prisma } from "@aros/db";
import type {
  AgentContext,
  AgentResult,
  AgentStep,
  AgentEventHandler,
  AgentEvent,
} from "./types";

/**
 * Provides a skeletal implementation for an agent, handling step execution,
 * timing, and event emissions. Concrete agents should extend this class.
 */
export abstract class BaseAgent {
  protected onEvent?: AgentEventHandler;
  protected steps: AgentStep[] = [];
  protected startTime: number = 0;
  protected tokensUsed: number = 0;
  protected context?: AgentContext;

  constructor(onEvent?: AgentEventHandler) {
    this.onEvent = onEvent;
  }

  /**
   * Executes the main logic of the agent.
   * This method must be implemented by subclasses.
   */
  abstract execute(context: AgentContext): Promise<AgentResult>;

  /**
   * Wraps a function call in a standardized `AgentStep`, handling timing,
   * status updates, event emissions, and error catching.
   * @param name The name of the step.
   * @param handler The async function to execute for the step.
   * @returns The result of the handler.
   */
  protected async runStep<T>(
    name: string,
    handler: () => Promise<T>,
  ): Promise<T> {
    const step: AgentStep = {
      name,
      status: "running",
      startedAt: new Date(),
    };
    this.steps.push(step);
    this.emit({ type: "step_start", step: name });

    try {
      const output = await handler();
      step.status = "completed";
      step.output = output as any; // Cast is acceptable here as output is unknown in AgentStep
      this.emit({ type: "step_complete", step: name, output });
      return output;
    } catch (err) {
      console.error(`Step "${name}" failed:`, err);
      step.status = "failed";
      step.error = err instanceof Error ? err.message : String(err);
      this.emit({ type: "step_error", step: name, error: step.error });
      throw err;
    } finally {
      step.completedAt = new Date();
      step.durationMs =
        step.completedAt.getTime() - (step.startedAt?.getTime() ?? 0);
    }
  }

  /**
   * Emits an agent event if an event handler is registered.
   * @param event The event to emit.
   */
  protected emit(event: AgentEvent): void {
    this.onEvent?.(event);
  }

  /**
   * Creates a successful AgentResult and logs usage.
   * @param output The final output of the agent execution.
   * @returns A successful AgentResult.
   */
  protected createSuccessResult(output: unknown): AgentResult {
    const result: AgentResult = {
      success: true,
      steps: this.steps,
      output,
      totalDurationMs: Date.now() - this.startTime,
      tokensUsed: this.tokensUsed,
    };
    
    // Fire and forget usage logging
    this.logUsage("AGENT_EXECUTION", "success", this.tokensUsed).catch(err => {
      console.error("[BaseAgent] Failed to log usage:", err);
    });

    this.emit({ type: "plan_complete", result });
    return result;
  }

  /**
   * Creates a failed AgentResult and logs usage.
   * @param err The error that caused the failure.
   * @returns A failed AgentResult.
   */
  protected createFailureResult(err: unknown): AgentResult {
    const error = err instanceof Error ? err.message : String(err);
    const result: AgentResult = {
      success: false,
      steps: this.steps,
      output: null,
      error,
      totalDurationMs: Date.now() - this.startTime,
      tokensUsed: this.tokensUsed,
    };

    this.logUsage("AGENT_EXECUTION", "failure", this.tokensUsed).catch(logErr => {
        console.error("[BaseAgent] Failed to log usage for error:", logErr);
    });

    return result;
  }

  protected recordTokenUsage(tokens: number): void {
    if (tokens < 0) return;
    this.tokensUsed += tokens;
  }

  protected async logUsage(purpose: string, status: string, tokens: number) {
    if (tokens <= 0 || !this.context) return;
    try {
      const model = (this.context.metadata?.model as string) || "gpt-4o";
      const rates: Record<string, number> = {
        "gpt-4o": 0.000005,
        "gpt-4o-mini": 0.00000015,
        "claude-3-5-sonnet": 0.000003,
      };
      const cost = tokens * (rates[model] || 0.00001);
      await prisma.aiUsageLog.create({
        data: {
          organizationId: this.context.organizationId,
          userId: (this.context.metadata?.userId as string) || null,
          model,
          promptTokens: Math.floor(tokens * 0.7),
          completionTokens: Math.floor(tokens * 0.3),
          totalTokens: tokens,
          purpose: `${purpose} (${status})`,
          cost,
        },
      });
    } catch (err) {
      console.error("[BaseAgent] usage log persist failed", err);
    }
  }
}