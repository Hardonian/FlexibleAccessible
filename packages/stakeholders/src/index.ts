// ─── @aros/stakeholders ─────────────────────────────────────────────────
// Complete stakeholder management system for AROS
// Includes: registry, power/interest matrix, underrepresented group tracking,
//           bias audit, feedback loops, communication plans, validation,
//           metrics, governance, and engagement scoring

// Types
export {
  type Stakeholder,
  type StakeholderCreateInput,
  type StakeholderUpdateInput,
  type StakeholderFilter,
  type StakeholderSummary,
  stakeholderCreateSchema,
  stakeholderUpdateSchema,
  stakeholderFilterSchema,
} from "./types/stakeholder";

export {
  type PowerInterestEntry,
  type EngagementStrategy,
  POWER_LEVELS,
  INTEREST_LEVELS,
  ENGAGEMENT_STRATEGIES,
} from "./types/power-interest";

export {
  type UnderrepresentedGroup,
  type OutreachRecord,
  type GroupEngagementStatus,
  UNDERREPRESENTED_GROUPS,
} from "./types/underrepresented";

export {
  type BiasAuditEntry,
  type BiasAuditResult,
  BIAS_DIMENSIONS,
} from "./types/bias-audit";

export {
  type FeedbackItem,
  type FeedbackCreateInput,
  type FeedbackUpdateInput,
  type FeedbackSummary,
  FEEDBACK_STATUSES,
  FEEDBACK_CATEGORIES,
} from "./types/feedback";

export {
  type CommunicationPlan,
  type CommunicationEntry,
  type Channel,
  COMMUNICATION_CADENCES,
  CHANNELS,
} from "./types/communication";

export {
  type ValidationRecord,
  type ValidationMethod,
  VALIDATION_METHODS,
} from "./types/validation";

export {
  type StakeholderMetric,
  type MetricTarget,
  type MaturityLevel,
  MATURITY_DIMENSIONS,
  MATURITY_LEVELS,
} from "./types/metrics";

export {
  type GovernanceCouncil,
  type CouncilMember,
  type EscalationRecord,
  GOVERNANCE_ROLES,
} from "./types/governance";

// Services
export { StakeholderRegistry } from "./services/registry";
export { PowerInterestMatrix } from "./services/power-interest-matrix";
export { UnderrepresentedGroupTracker } from "./services/underrepresented-tracker";
export { BiasAuditEngine } from "./services/bias-audit";
export { FeedbackLoopManager } from "./services/feedback-loop";
export { CommunicationPlanner } from "./services/communication-planner";
export { ValidationFramework } from "./services/validation-framework";
export { MetricsTracker } from "./services/metrics-tracker";
export { GovernanceManager } from "./services/governance-manager";
export { EngagementScorer } from "./services/engagement-scorer";

// Utilities
export { buildStakeholderAnalysis } from "./utils/analysis-builder";
export {
  generateGapAnalysis,
  type GapAnalysisReport,
} from "./utils/gap-analysis";
export { createChecklist } from "./utils/checklist-generator";
