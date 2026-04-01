# AI Visual Review — Project Plan & Implementation Guide

## 1. Executive Summary

**Objective:** Replace the stub `GeminiVisualReviewer` agent with a production-grade, multi-modal accessibility analysis pipeline that detects WCAG violations beyond the 30-40% axe-core coverage through vision model analysis, keyboard flow simulation, and screen reader simulation.

**Success Criteria:**

- Vision model analysis detects contrast, layout, and focus issues axe-core misses
- Keyboard flow simulation records tab order and identifies focus traps
- Screen reader simulation compares expected vs actual accessibility tree
- All results integrate into the existing finding/clustering/remediation pipeline
- Per-page analysis completes within 5 seconds
- Confidence scoring enables human-in-the-loop for ambiguous results

**Non-Goals:**

- Replacing axe-core (complementary, not a replacement)
- Guaranteed WCAG conformance claims
- Real-time screen reader testing (simulation only)

## 2. Goals and Constraints

**Measurable Objectives:**

- Coverage: detect at least 10 additional WCAG 2.2 AA criteria beyond axe-core
- Latency: ≤5s per page for vision analysis, ≤3s for keyboard simulation
- Cost: ≤$0.05 per page at current API pricing
- Accuracy: ≥80% precision on vision-detected issues (validated against manual audits)

**Timeline:** 6.5 working days + 1 day contingency = 7.5 days

**Budget Guardrails:**

- Vision API cost cap: $50/month for development, $500/month for production
- Redis cache hit rate target: ≥60% (deduplicate by DOM hash)
- Max 10 pages per scan reviewed by vision model (cost-disciplined)

**Hard Constraints:**

- Must not auto-publish risky fixes (human approval required)
- Must not claim guaranteed compliance
- Must preserve existing scan pipeline behavior

## 3. Reference Architecture

```
packages/ai-review/
  src/
    index.ts                    # Public API exports
    types.ts                    # All interfaces and schemas
    vision-analyzer.ts          # Screenshot → AI analysis pipeline
    keyboard-simulator.ts       # Tab order recording + focus trap detection
    screen-reader-sim.ts        # Accessibility tree comparison
    prompts.ts                  # Vision model prompt templates
    cache.ts                    # Redis-backed result caching
    confidence.ts               # Confidence scoring + human-in-the-loop routing
    __tests__/
      vision-analyzer.test.ts
      keyboard-simulator.test.ts
      screen-reader-sim.test.ts
      confidence.test.ts
      prompts.test.ts
```

**Data Flow:**

```
scan worker completes
  → enqueues visual-review job
    → keyboard-simulator: record tab order via Playwright
    → screen-reader-sim: extract + compare accessibility tree
    → vision-analyzer: screenshot → Claude/GPT-4V → structured JSON
    → confidence: score each finding, route low-confidence to review
    → persist as FindingEvidence records with kind=AI_VISUAL_REVIEW
    → create CanonicalFinding for high-confidence new issues
```

**External Dependencies:**

- Playwright (already in worker) — screenshot, keyboard, accessibility tree
- Anthropic API (ANTHROPIC_API_KEY) or OpenAI API (OPENAI_API_KEY)
- Redis (already in stack) — result caching
- Prisma (already in stack) — persistence

## 4. Deliverables

| Artifact                   | Type    | Location                                                       |
| -------------------------- | ------- | -------------------------------------------------------------- |
| `packages/ai-review/`      | Package | New package with 8 source files                                |
| Prisma migration           | Schema  | `schema.prisma` — AiVisualReviewRun, AiVisualFinding models    |
| Updated visual-reviewer.ts | Agent   | `packages/agents/src/visual-reviewer.ts` — real implementation |
| Worker integration         | Worker  | `apps/worker/src/index.ts` — updated job handler               |
| API routes                 | API     | `apps/web/src/app/api/visual-review/` — trigger + poll         |
| Tests                      | Test    | 5 test files with 25+ test cases                               |
| Documentation              | Docs    | This document                                                  |

## 5. Work Breakdown Structure

### Task 1: Package Scaffolding + Types

- **Objective:** Create `packages/ai-review/` with package.json, tsconfig, types
- **Inputs:** Existing package conventions
- **Outputs:** `packages/ai-review/package.json`, `tsconfig.json`, `src/types.ts`, `src/index.ts`
- **Acceptance Criteria:** `npm run typecheck --workspace=packages/ai-review` passes
- **Effort:** 0.25 days
- **Risk:** Low
- **Dependencies:** None
- **Owner:** Platform Engineer

### Task 2: Vision Analyzer Module

- **Objective:** Screenshot capture + AI vision model analysis pipeline
- **Inputs:** Playwright page object, WCAG criteria list
- **Outputs:** Structured JSON with per-criterion status and issues
- **Acceptance Criteria:** Given a screenshot, returns valid JSON with criteria assessments
- **Effort:** 1.5 days
- **Risk:** Medium (prompt reliability, API cost)
- **Mitigations:** Structured JSON output, retry on parse failure, confidence thresholds
- **Dependencies:** Task 1
- **Owner:** AI/ML Engineer

### Task 3: Keyboard Flow Simulator

- **Objective:** Record tab order, detect focus traps, verify skip links
- **Inputs:** Playwright page object
- **Outputs:** Tab order array, focus trap detections, skip link presence
- **Acceptance Criteria:** Records ≥50 tab stops, detects missing skip links, identifies focus traps
- **Effort:** 0.75 days
- **Risk:** Low
- **Mitigations:** Timeout-based trap detection, configurable max tabs
- **Dependencies:** Task 1
- **Owner:** Frontend Engineer

### Task 4: Screen Reader Simulator

- **Objective:** Compare accessibility tree against expected reading order
- **Inputs:** Playwright page object, DOM snapshot
- **Outputs:** Missing labels, reading order issues, dynamic content announcement gaps
- **Acceptance Criteria:** Detects unlabeled interactive elements, identifies order mismatches
- **Effort:** 0.75 days
- **Risk:** Medium (accessibility tree API differences across browsers)
- **Mitigations:** Graceful fallback, Chromium-only for v1
- **Dependencies:** Task 1
- **Owner:** Frontend Engineer

### Task 5: Confidence Scoring + Caching

- **Objective:** Score findings by confidence, route to human review, cache results
- **Inputs:** Vision/keyboard/screen reader results
- **Outputs:** Scored findings, cached by DOM hash
- **Acceptance Criteria:** Low-confidence findings (<0.7) create ReviewTask, cache hit rate ≥40%
- **Effort:** 0.5 days
- **Risk:** Low
- **Dependencies:** Tasks 2, 3, 4
- **Owner:** Platform Engineer

### Task 6: Prisma Schema + Persistence

- **Objective:** Add AiVisualReviewRun + AiVisualFinding models, persist results
- **Inputs:** Existing schema patterns
- **Outputs:** New models, migration
- **Acceptance Criteria:** `npm run db:push` applies without error
- **Effort:** 0.25 days
- **Risk:** Low
- **Dependencies:** Task 1
- **Owner:** Backend Engineer

### Task 7: Worker Integration

- **Objective:** Wire ai-review into existing visual-review queue
- **Inputs:** Existing worker structure
- **Outputs:** Updated `handleVisualReviewJob` in worker index
- **Acceptance Criteria:** Scan completion triggers visual review, results persisted
- **Effort:** 0.5 days
- **Risk:** Low
- **Dependencies:** Tasks 2-6
- **Owner:** Platform Engineer

### Task 8: API Routes

- **Objective:** Endpoints for triggering and polling visual review results
- **Inputs:** Existing API patterns
- **Outputs:** `GET /api/visual-review/[runId]`, `POST /api/visual-review/trigger`
- **Acceptance Criteria:** Returns structured review results with findings
- **Effort:** 0.25 days
- **Risk:** Low
- **Dependencies:** Task 7
- **Owner:** Backend Engineer

### Task 9: Tests

- **Objective:** Unit tests for all modules, integration test for pipeline
- **Inputs:** All modules
- **Outputs:** 5 test files, ≥25 test cases
- **Acceptance Criteria:** All tests pass, coverage ≥80% on new code
- **Effort:** 0.75 days
- **Risk:** Low
- **Dependencies:** Tasks 2-8
- **Owner:** QA Engineer

## 6. Timeline

```
Day 1: Task 1 (scaffold) + Task 6 (schema) + Task 3 (keyboard)
Day 2: Task 2 (vision analyzer) — core implementation
Day 3: Task 2 (vision analyzer) — prompt engineering + testing
Day 4: Task 4 (screen reader) + Task 5 (confidence + caching)
Day 5: Task 7 (worker integration) + Task 8 (API routes)
Day 6: Task 9 (tests)
Day 7: Buffer + integration testing + bug fixes
Day 7.5: Contingency
```

**Critical Path:** Task 1 → Task 2 → Task 5 → Task 7 → Task 8 → Task 9
**Slack:** Tasks 3, 4, 6 can run in parallel with Task 2

## 7. Vision Model Prompting Plan

### 7.1 Input Schema

```typescript
interface VisionAnalysisInput {
  screenshotBase64: string; // JPEG base64, viewport 1280x720
  url: string; // Page URL for context
  pageTitle: string; // <title> content
  axeViolations: Array<{
    // Known axe violations for correlation
    ruleId: string;
    impact: string;
    selector: string;
    description: string;
  }>;
  domSummary: string; // Truncated DOM (first 3000 chars)
  accessibilityTreeSummary: string; // Truncated tree (first 2000 chars)
}
```

### 7.2 Output Schema

```typescript
interface VisionAnalysisOutput {
  page_id: string;
  url: string;
  timestamp: string; // ISO 8601
  model_version: string; // e.g., "claude-sonnet-4-20250514"
  latency_ms: number;
  overall_score: number; // 0-100
  criteria_status: Array<{
    criterion_id: string; // e.g., "1.4.3"
    criterion_name: string; // e.g., "Contrast (Minimum)"
    level: string; // "A" | "AA"
    status: "pass" | "fail" | "partial" | "not_applicable" | "uncertain";
    confidence: number; // 0.0-1.0
    issues: Array<{
      description: string;
      severity: "critical" | "serious" | "moderate" | "minor";
      selector: string; // Best-guess CSS selector
      element_description: string; // Human-readable element description
      suggested_fix: string;
      evidence: string; // What was observed in the screenshot
    }>;
  }>;
  keyboard_analysis: {
    tab_order_recorded: boolean;
    total_focusable_elements: number;
    focus_traps_detected: number;
    skip_link_present: boolean;
    focus_visible_issues: number;
  };
  screen_reader_analysis: {
    unlabeled_interactive_elements: number;
    reading_order_issues: number;
    missing_landmarks: string[];
    dynamic_content_announced: boolean;
  };
  requires_human_review: boolean;
  human_review_reasons: string[];
}
```

### 7.3 Confidence Thresholds

| Confidence | Action                                               |
| ---------- | ---------------------------------------------------- |
| ≥0.85      | Auto-create CanonicalFinding, mark as MODEL_ASSISTED |
| 0.70-0.84  | Create finding but route to ReviewTask for approval  |
| <0.70      | Log as FindingEvidence only, do not create finding   |
| <0.50      | Discard (below minimum threshold)                    |

### 7.4 Prompt Template — Primary Analysis

```
You are an expert web accessibility auditor analyzing a screenshot of a web page.

## Page Context
- URL: {url}
- Title: {pageTitle}

## Known Automated Findings (from axe-core)
{axe_violations_list}

## Accessibility Tree Summary
{accessibility_tree_summary}

## Task
Analyze the screenshot for WCAG 2.2 Level AA violations that automated tools cannot detect. Focus on:

1. **Color Contrast (1.4.3, 1.4.11):** Are text and UI elements readable? Check text-on-background, button borders, link colors.
2. **Focus Visible (2.4.7):** Are focus indicators present and visible? Check for hidden outlines or custom focus styles.
3. **Text Spacing (1.4.12):** Would increased line-height/letter-spacing break the layout?
4. **Reflow (1.4.10):** Does the layout look like it would reflow at 400% zoom?
5. **Content on Hover (1.4.13):** Are there elements that might show tooltips/popups on hover?
6. **Label in Name (2.5.3):** Do visible labels match accessible names?
7. **Consistent Navigation (3.2.3):** Does this look like a standard page with consistent nav?
8. **Error Identification (3.3.1):** Are there form elements that might have unclear error states?
9. **Use of Color (1.4.1):** Is color used as the only means of conveying information?
10. **Sensory Characteristics (1.3.3):** Are there instructions relying on shape/color/position?

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{json_schema}
```

### 7.5 Success Output Example

```json
{
  "page_id": "page_abc123",
  "url": "https://example.com/login",
  "timestamp": "2025-03-31T22:00:00Z",
  "model_version": "claude-sonnet-4-20250514",
  "latency_ms": 3200,
  "overall_score": 72,
  "criteria_status": [
    {
      "criterion_id": "1.4.3",
      "criterion_name": "Contrast (Minimum)",
      "level": "AA",
      "status": "fail",
      "confidence": 0.92,
      "issues": [
        {
          "description": "Light gray placeholder text (#9ca3af) on white background (#ffffff) has contrast ratio 2.85:1, below 4.5:1 minimum",
          "severity": "serious",
          "selector": "input[placeholder]",
          "element_description": "Email input field placeholder text",
          "suggested_fix": "Darken placeholder text to at least #767676 for 4.5:1 ratio",
          "evidence": "Screenshot shows very light gray text in the email input field"
        }
      ]
    },
    {
      "criterion_id": "2.4.7",
      "criterion_name": "Focus Visible",
      "level": "AA",
      "status": "uncertain",
      "confidence": 0.65,
      "issues": []
    }
  ],
  "keyboard_analysis": {
    "tab_order_recorded": true,
    "total_focusable_elements": 8,
    "focus_traps_detected": 0,
    "skip_link_present": false,
    "focus_visible_issues": 1
  },
  "screen_reader_analysis": {
    "unlabeled_interactive_elements": 1,
    "reading_order_issues": 0,
    "missing_landmarks": ["main"],
    "dynamic_content_announced": false
  },
  "requires_human_review": true,
  "human_review_reasons": [
    "Focus visibility cannot be confirmed from static screenshot"
  ]
}
```

### 7.6 Failure/Retry Case

```json
{
  "page_id": "page_abc123",
  "url": "https://example.com/login",
  "timestamp": "2025-03-31T22:00:00Z",
  "model_version": "claude-sonnet-4-20250514",
  "latency_ms": 0,
  "overall_score": -1,
  "criteria_status": [],
  "requires_human_review": true,
  "human_review_reasons": [
    "Vision model returned unparseable response after 2 retries"
  ],
  "_error": "JSON.parse failed on response after 2 attempts"
}
```

**Retry Logic:**

1. First attempt: structured prompt with JSON schema
2. If parse fails: retry with simplified prompt (fewer criteria, stricter instructions)
3. If second attempt fails: log error, return empty result with `requires_human_review: true`

## 8. Data and Output Schemas

### Per-Page Analysis Payload

Stored as `FindingEvidence.jsonValue`:

```typescript
interface PageAnalysisRecord {
  analysis_type: "vision" | "keyboard" | "screen_reader";
  page_id: string;
  url: string;
  timestamp: string;
  model: string;
  latency_ms: number;
  confidence: number;
  criteria_checked: number;
  criteria_failed: number;
  criteria_uncertain: number;
  issues: Array<{
    criterion_id: string;
    severity: string;
    description: string;
    selector: string;
    confidence: number;
  }>;
  raw_response?: string; // First 1000 chars for debugging
}
```

### Batch Metadata

Stored as `AiVisualReviewRun`:

```typescript
interface VisualReviewRunRecord {
  id: string;
  scanRunId: string;
  siteId: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  pagesReviewed: number;
  totalFindings: number;
  highConfidenceFindings: number;
  humanReviewRequired: number;
  totalCostUsd: number;
  totalLatencyMs: number;
  startedAt: Date;
  completedAt: Date | null;
}
```

### Logging Fields

Every vision analysis call logs:

```
[VisualReview] {action} | page={url} | model={model} | latency={ms} | cost={usd} | confidence={score} | criteria={pass}/{total}
```

## 9. Performance, Cost, and Caching

**Per-Page Cost Ranges:**

- Vision analysis (Claude Sonnet): $0.01-0.03 per page (depends on image size + response length)
- Vision analysis (GPT-4o): $0.02-0.05 per page
- Keyboard simulation: $0 (local Playwright, no API)
- Screen reader simulation: $0 (local Playwright, no API)

**Latency Targets:**

- Vision: 2-5 seconds per screenshot
- Keyboard: 1-3 seconds per page (50 tab presses)
- Screen reader: <1 second per page (tree extraction)

**Batching Strategy:**

- Max 10 pages per scan reviewed by vision model
- Priority: CRITICAL/SERIOUS violations first
- Deduplicate by DOM content hash (skip if DOM unchanged since last review)

**Caching:**

- Key: `sha256(domSnapshot + viewportWidth)`
- TTL: 24 hours
- Invalidation: on DOM change or manual re-scan
- Expected hit rate: 40-60% for incremental scans

**Rate Limits:**

- Anthropic: 1000 RPM → max 2 concurrent vision requests per worker
- OpenAI: 500 RPM → max 1 concurrent vision request per worker
- Retry: exponential backoff, max 3 retries

## 10. Testing Strategy

**Unit Tests (per module):**

- `vision-analyzer.test.ts`: prompt construction, JSON parsing, retry logic, confidence extraction
- `keyboard-simulator.test.ts`: tab order recording, trap detection, skip link detection
- `screen-reader-sim.test.ts`: tree extraction, label checking, landmark detection
- `confidence.test.ts`: threshold routing, score calculation
- `prompts.test.ts`: template rendering, schema validation

**Integration Tests:**

- Full pipeline: page load → keyboard sim → screen reader sim → vision analysis → persist
- Mock vision API responses for deterministic testing
- Verify FindingEvidence and CanonicalFinding creation

**Acceptance Criteria per Category:**

- Unit: ≥90% branch coverage on new code
- Integration: Pipeline completes within 10s per page
- Accessibility: Vision analysis detects ≥3 known violations on test fixtures
- Performance: No regression to existing scan latency

## 11. Deployment and Rollout

**Feature Flag:** `AI_VISUAL_REVIEW_ENABLED` (env var, default: true)

**Rollout Approach:**

1. Deploy with feature flag OFF in staging
2. Enable for 1 internal test site
3. Validate findings against manual audit
4. Enable for all Professional/Enterprise sites
5. Monitor cost + accuracy for 1 week
6. General availability

**Rollback Criteria:**

- Vision API error rate >10%
- Average latency >10s per page
- False positive rate >30% (validated against manual audit)
- Monthly cost exceeds budget by >20%

**Rollback Procedure:**

1. Set `AI_VISUAL_REVIEW_ENABLED=false`
2. Worker stops enqueuing visual-review jobs
3. Existing findings remain (read-only)
4. No data migration needed

## 12. Monitoring, Observability, and SLAs

**Dashboards:**

- Pipeline health: jobs queued/completed/failed per hour
- Latency: p50/p95/p99 per analysis type
- Cost: cumulative spend per day/week/month
- Coverage: WCAG criteria checked vs total criteria
- Accuracy: % of findings confirmed on manual review

**Alerts:**

- Error rate >5% over 15 minutes → PagerDuty
- Latency p95 >10s → Slack warning
- Daily cost >$20 → Slack notification
- Cache hit rate <20% → investigate DOM stability

**KPIs:**

- Additional WCAG criteria detected vs axe-core baseline
- % of vision findings accepted by human reviewers
- Time saved per site audit (estimated)
- False positive rate

**SLOs:**

- 95% of visual reviews complete within 30s per page
- 99% pipeline availability (excluding upstream API outages)
- <5% unhandled failures per week

## 13. Security and Privacy

**Data Handling:**

- Screenshots stored as data URIs in PageSnapshot (existing pattern)
- No PII extraction from screenshots
- Vision model prompts include URL but not cookies/tokens
- API keys stored in env vars, never in prompts

**Access Control:**

- Visual review results scoped to organization via existing tenant boundaries
- API routes require session + org membership

**Audit Logging:**

- All vision API calls logged to AiUsageLog (existing model)
- Cost attribution per organization

## 14. Dependencies and Prerequisites

| Dependency          | Version   | Purpose                                  |
| ------------------- | --------- | ---------------------------------------- |
| Playwright          | ^1.49.0   | Screenshot, keyboard, accessibility tree |
| ANTHROPIC_API_KEY   | —         | Claude vision analysis                   |
| OPENAI_API_KEY      | —         | GPT-4o vision analysis (fallback)        |
| Redis               | 7.x       | Result caching                           |
| PostgreSQL          | 15+       | Persistence                              |
| @aros/db            | workspace | Prisma client                            |
| @aros/shared        | workspace | Utilities, queue names                   |
| @aros/core-services | workspace | Finding evidence recording               |

## 15. Risk Register

| Risk                                           | Probability | Impact | Detection                  | Mitigation                                                       |
| ---------------------------------------------- | ----------- | ------ | -------------------------- | ---------------------------------------------------------------- |
| Vision API cost exceeds budget                 | Medium      | High   | Daily cost alert           | Max 10 pages/review, cache dedup, cost cap env var               |
| Low prompt reliability (hallucinated findings) | Medium      | Medium | False positive rate metric | Confidence thresholds, human-in-the-loop, structured JSON output |
| Vision API latency >5s                         | Low         | Medium | p95 latency alert          | Async pipeline, timeout at 10s, fallback to axe-only             |
| Accessibility tree API changes                 | Low         | High   | Integration test failures  | Chromium-only for v1, graceful fallback                          |
| Focus trap detection false positives           | Medium      | Low    | Manual review              | Configurable max tabs, timeout-based detection                   |

## 16. Acceptance Criteria to Go-Live

- [ ] All unit tests pass (≥25 test cases)
- [ ] Integration test: full pipeline completes for test page
- [ ] Vision analysis returns valid JSON for 10 diverse test pages
- [ ] Keyboard simulator records tab order and detects missing skip links
- [ ] Screen reader simulator detects unlabeled interactive elements
- [ ] Confidence scoring routes low-confidence findings to review queue
- [ ] Cache hit rate ≥40% on re-scans of unchanged pages
- [ ] Per-page latency p95 ≤5s for vision analysis
- [ ] Per-page cost ≤$0.05
- [ ] Feature flag controls visual review enablement
- [ ] No regression to existing scan pipeline
- [ ] API routes return structured results
- [ ] Rollback procedure tested in staging
