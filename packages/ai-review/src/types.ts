export type VisionProvider = "anthropic" | "openai";

export interface AxeViolationSummary {
  ruleId: string;
  impact: "minor" | "moderate" | "serious" | "critical" | null;
  selector: string;
  description: string;
}

export interface VisionAnalysisInput {
  screenshotBase64: string;
  url: string;
  pageTitle: string;
  axeViolations: AxeViolationSummary[];
  domSummary: string;
  accessibilityTreeSummary: string;
}

export interface CriterionIssue {
  description: string;
  severity: "critical" | "serious" | "moderate" | "minor";
  selector: string;
  element_description: string;
  suggested_fix: string;
  evidence: string;
}

export interface CriterionStatus {
  criterion_id: string;
  criterion_name: string;
  level: "A" | "AA" | "AAA";
  status: "pass" | "fail" | "partial" | "not_applicable" | "uncertain";
  confidence: number;
  issues: CriterionIssue[];
}

export interface KeyboardAnalysisResult {
  tab_order_recorded: boolean;
  total_focusable_elements: number;
  tab_order: string[];
  focus_traps_detected: number;
  focus_trap_selectors: string[];
  skip_link_present: boolean;
  skip_link_target: string | null;
  focus_visible_issues: number;
  focus_visible_issue_selectors: string[];
}

export interface ScreenReaderAnalysisResult {
  unlabeled_interactive_elements: number;
  unlabeled_selectors: string[];
  reading_order_issues: number;
  missing_landmarks: string[];
  dynamic_content_announced: boolean;
  heading_hierarchy_valid: boolean;
  heading_issues: string[];
}

export interface VisionAnalysisOutput {
  page_id: string;
  url: string;
  timestamp: string;
  model_version: string;
  latency_ms: number;
  overall_score: number;
  criteria_status: CriterionStatus[];
  requires_human_review: boolean;
  human_review_reasons: string[];
}

export interface CombinedReviewResult {
  vision: VisionAnalysisOutput | null;
  keyboard: KeyboardAnalysisResult;
  screenReader: ScreenReaderAnalysisResult;
  pageId: string;
  url: string;
  timestamp: string;
  requiresHumanReview: boolean;
  humanReviewReasons: string[];
}

export interface VisualReviewJobData {
  siteId: string;
  scanRunId: string;
  organizationId?: string;
}

export interface ReviewFinding {
  criterionId: string;
  criterionName: string;
  level: string;
  status: string;
  confidence: number;
  severity: string;
  description: string;
  selector: string;
  suggestedFix: string;
  source: "vision" | "keyboard" | "screen_reader";
}

export type ConfidenceAction =
  | "auto_create"
  | "review_required"
  | "evidence_only"
  | "discard";

export interface ScoredFinding extends ReviewFinding {
  action: ConfidenceAction;
}

export const CONFIDENCE_AUTO_CREATE = 0.85;
export const CONFIDENCE_REVIEW_REQUIRED = 0.7;
export const CONFIDENCE_MINIMUM = 0.5;
export const MAX_PAGES_PER_REVIEW = 10;
export const VISION_TIMEOUT_MS = 10_000;
export const KEYBOARD_MAX_TABS = 50;
export const KEYBOARD_TAB_DELAY_MS = 50;
export const FOCUS_TRAP_THRESHOLD = 5;
