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
  protected context: AgentContext;

  constructor(context: AgentContext, onEvent?: AgentEventHandler) {
    this.context = context;
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
   * Creates a successful AgentResult.
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
    this.emit({ type: "plan_complete", result });
    return result;
  }

  /**
   * Creates a failed AgentResult.
   * @param err The error that caused the failure.
   * @returns A failed AgentResult.
   */
  protected createFailureResult(err: unknown): AgentResult {
    return {
      success: false,
      steps: this.steps,
      output: null,
      error: err instanceof Error ? err.message : String(err),
      totalDurationMs: Date.now() - this.startTime,
      tokensUsed: this.tokensUsed,
    };
  }
}