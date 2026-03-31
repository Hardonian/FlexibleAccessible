export interface AgentContext {
  organizationId: string;
  siteId?: string;
  findingId?: string;
  metadata: Record<string, unknown>;
}

export interface AgentStep {
  name: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  input?: unknown;
  output?: unknown;
  error?: string;
  durationMs?: number;
  startedAt?: Date;
  completedAt?: Date;
}

export interface AgentResult {
  success: boolean;
  steps: AgentStep[];
  output: unknown;
  error?: string;
  totalDurationMs: number;
  tokensUsed: number;
}

export interface AgentPlan {
  name: string;
  description: string;
  steps: Array<{
    name: string;
    description: string;
    handler: string;
    dependsOn?: string[];
  }>;
}

export type AgentEvent =
  | { type: "step_start"; step: string }
  | { type: "step_complete"; step: string; output: unknown }
  | { type: "step_error"; step: string; error: string }
  | { type: "plan_complete"; result: AgentResult };

export type AgentEventHandler = (event: AgentEvent) => void;
