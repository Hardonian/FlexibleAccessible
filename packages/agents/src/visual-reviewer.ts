import { prisma } from "@aros/db";
import { chromium, type Browser } from "playwright";
import { AgentContext, AgentResult, AgentEventHandler } from "./types.js";
import { BaseAgent } from "./base-agent.js";
import {
  analyzeWithVision,
  simulateKeyboardFlow,
  simulateScreenReader,
  scoreFindings,
  requiresHumanReview,
  generateCacheKey,
  getCachedReview,
  setCachedReview,
  computeOverallScore,
  CONFIDENCE_AUTO_CREATE,
  CONFIDENCE_REVIEW_REQUIRED,
  MAX_PAGES_PER_REVIEW,
} from "@aros/ai-review";
import type {
  VisionAnalysisOutput,
  CombinedReviewResult,
  CriterionStatus,
} from "@aros/ai-review";

/**
 * Production-grade AI visual reviewer.
 * Analyzes screenshots via vision models, records keyboard flow,
 * simulates screen reader behavior, and creates structured findings.
 */
export class GeminiVisualReviewer extends BaseAgent {
  constructor(onEvent?: AgentEventHandler) {
    super(onEvent);
  }

  async execute(context: AgentContext): Promise<AgentResult> {
    this.context = context;
    this.startTime = Date.now();

    let browser: Browser | null = null;

    try {
      const { scanRunId } = context.metadata as { scanRunId: string };
      if (!scanRunId) throw new Error("scanRunId required in metadata");

      // Create a visual review run record
      const reviewRun = await this.runStep("create_review_run", async () => {
        return prisma.aiVisualReviewRun.create({
          data: {
            scanRunId,
            siteId: context.siteId!,
            status: "RUNNING",
            startedAt: new Date(),
          },
        });
      });

      // Step 1: Identify high-signal review candidates (CRITICAL/SERIOUS violations)
      const candidates = await this.runStep("identify_candidates", async () => {
        const findings = await prisma.rawViolation.findMany({
          where: {
            scanRunId,
            impact: { in: ["CRITICAL", "SERIOUS"] },
          },
          include: {
            page: {
              include: {
                snapshots: { take: 1, orderBy: { capturedAt: "desc" } },
              },
            },
          },
          take: MAX_PAGES_PER_REVIEW,
          distinct: ["pageId"],
        });
        return findings;
      });

      if (candidates.length === 0) {
        await prisma.aiVisualReviewRun.update({
          where: { id: reviewRun.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
        return this.createSuccessResult({
          reviewedCount: 0,
          reason: "No high-signal candidates found",
        });
      }

      // Step 2: Launch browser for keyboard + screen reader analysis
      browser = await this.runStep("launch_browser", async () => {
        return chromium.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
      });

      let totalFindings = 0;
      let highConfidenceFindings = 0;
      let humanReviewRequired = 0;
      let totalLatencyMs = 0;
      const reviewedPages: string[] = [];

      // Step 3: Analyze each candidate page
      for (const candidate of candidates) {
        const pageUrl = candidate.page.url;
        const pageId = candidate.page.id;

        try {
          const pageResult = await this.analyzePage(
            browser,
            candidate,
            pageUrl,
            pageId,
            reviewRun.id,
            context.siteId!,
          );

          totalFindings += pageResult.findingsCreated;
          highConfidenceFindings += pageResult.highConfidence;
          humanReviewRequired += pageResult.needsReview;
          totalLatencyMs += pageResult.latencyMs;
          reviewedPages.push(pageUrl);

          this.tokensUsed += pageResult.tokensUsed;
        } catch (err) {
          console.error(`[VisualReviewer] Error analyzing ${pageUrl}:`, err);
        }
      }

      // Step 4: Update review run with final stats
      await prisma.aiVisualReviewRun.update({
        where: { id: reviewRun.id },
        data: {
          status: "COMPLETED",
          pagesReviewed: reviewedPages.length,
          totalFindings,
          highConfidenceFindings,
          humanReviewRequired,
          totalLatencyMs,
          completedAt: new Date(),
        },
      });

      return this.createSuccessResult({
        reviewedCount: reviewedPages.length,
        totalFindings,
        highConfidenceFindings,
        humanReviewRequired,
        reviewRunId: reviewRun.id,
      });
    } catch (err) {
      return this.createFailureResult(err);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Analyze a single page with vision, keyboard, and screen reader simulations.
   */
  private async analyzePage(
    browser: Browser,
    candidate: any,
    pageUrl: string,
    pageId: string,
    reviewRunId: string,
    siteId: string,
  ): Promise<{
    findingsCreated: number;
    highConfidence: number;
    needsReview: number;
    latencyMs: number;
    tokensUsed: number;
  }> {
    const startTime = Date.now();
    let findingsCreated = 0;
    let highConfidence = 0;
    let needsReview = 0;
    let tokensUsed = 0;

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    try {
      await page.goto(pageUrl, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await page.waitForTimeout(1000);

      // Run keyboard simulation
      const keyboardResult = await simulateKeyboardFlow(page);

      // Run screen reader simulation
      const screenReaderResult = await simulateScreenReader(page);

      // Get all violations on this page for the vision prompt
      const pageViolations = await prisma.rawViolation.findMany({
        where: { pageId },
        select: {
          ruleId: true,
          impact: true,
          selector: true,
          description: true,
        },
        take: 20,
      });

      // Get the latest snapshot for DOM and screenshot
      const snapshot = candidate.page.snapshots?.[0];
      let screenshotBase64 = "";
      let domSummary = "";

      if (snapshot) {
        if (snapshot.screenshotKey?.startsWith("data:image")) {
          screenshotBase64 = snapshot.screenshotKey.split(",")[1] ?? "";
        }
        domSummary = (snapshot.domSnapshot ?? "").slice(0, 3000);
      }

      // Check cache for vision analysis
      const cacheKey = generateCacheKey(domSummary, 1280);
      let visionResult: VisionAnalysisOutput | null =
        await getCachedReview<VisionAnalysisOutput>(cacheKey);

      if (!visionResult && screenshotBase64) {
        // Run vision analysis
        visionResult = await analyzeWithVision(
          {
            screenshotBase64,
            url: pageUrl,
            pageTitle: candidate.page.title ?? "",
            axeViolations: pageViolations.map((v: any) => ({
              ruleId: v.ruleId,
              impact: v.impact,
              selector: v.selector,
              description: v.description,
            })),
            domSummary,
            accessibilityTreeSummary: JSON.stringify(screenReaderResult).slice(
              0,
              2000,
            ),
          },
          pageId,
        );

        // Cache the result
        if (visionResult.overall_score >= 0) {
          await setCachedReview(cacheKey, visionResult);
        }

        tokensUsed += 1500; // Estimated tokens for vision analysis
      }

      // Build combined result
      const combined: CombinedReviewResult = {
        vision: visionResult,
        keyboard: keyboardResult,
        screenReader: screenReaderResult,
        pageId,
        url: pageUrl,
        timestamp: new Date().toISOString(),
        requiresHumanReview: false,
        humanReviewReasons: [],
      };

      // Process vision findings
      if (visionResult) {
        const { required, reasons } = requiresHumanReview(
          visionResult.criteria_status,
        );
        combined.requiresHumanReview = required;
        combined.humanReviewReasons = reasons;

        const newFindingsData = [];

        for (const criteria of visionResult.criteria_status) {
          for (const issue of criteria.issues) {
            const action =
              criteria.confidence >= CONFIDENCE_AUTO_CREATE
                ? "auto_create"
                : criteria.confidence >= CONFIDENCE_REVIEW_REQUIRED
                  ? "review_required"
                  : "evidence_only";

            if (action === "evidence_only" && criteria.confidence < 0.5)
              continue;

            newFindingsData.push({
              reviewRunId,
              siteId,
              pageId,
              criterionId: criteria.criterion_id,
              criterionName: criteria.criterion_name,
              level: criteria.level,
              status: criteria.status,
              confidence: criteria.confidence,
              severity: issue.severity,
              description: issue.description,
              selector: issue.selector || null,
              suggestedFix: issue.suggested_fix || null,
              source: "vision",
              action,
              metadata: {
                evidence: issue.evidence,
                elementDescription: issue.element_description,
                modelVersion: visionResult.model_version,
                latencyMs: visionResult.latency_ms,
              },
            });

            findingsCreated++;
            if (action === "auto_create") highConfidence++;
            if (action === "review_required") needsReview++;
          }
        }

        if (newFindingsData.length > 0) {
          await prisma.aiVisualFinding.createMany({
            data: newFindingsData,
          });
        }
      }

      // Process keyboard findings (missing skip link, focus traps)
      if (!keyboardResult.skip_link_present) {
        await prisma.aiVisualFinding.create({
          data: {
            reviewRunId,
            siteId,
            pageId,
            criterionId: "2.4.1",
            criterionName: "Bypass Blocks",
            level: "A",
            status: "fail",
            confidence: 0.9,
            severity: "moderate",
            description: "No skip navigation link detected",
            source: "keyboard",
            action: "auto_create",
            metadata: { keyboardResult: true },
          },
        });
        findingsCreated++;
        highConfidence++;
      }

      if (keyboardResult.focus_traps_detected > 0) {
        await prisma.aiVisualFinding.create({
          data: {
            reviewRunId,
            siteId,
            pageId,
            criterionId: "2.1.2",
            criterionName: "No Keyboard Trap",
            level: "A",
            status: "fail",
            confidence: 0.95,
            severity: "critical",
            description: `Focus trap detected: ${keyboardResult.focus_trap_selectors.join(", ")}`,
            source: "keyboard",
            action: "auto_create",
            metadata: {
              trapSelectors: keyboardResult.focus_trap_selectors,
            },
          },
        });
        findingsCreated++;
        highConfidence++;
      }

      // Process screen reader findings (missing landmarks)
      for (const landmark of screenReaderResult.missing_landmarks) {
        await prisma.aiVisualFinding.create({
          data: {
            reviewRunId,
            siteId,
            pageId,
            criterionId: "1.3.1",
            criterionName: "Info and Relationships",
            level: "A",
            status: "fail",
            confidence: 0.85,
            severity: "moderate",
            description: `Missing ${landmark} landmark region`,
            source: "screen_reader",
            action: "auto_create",
            metadata: { landmark },
          },
        });
        findingsCreated++;
        highConfidence++;
      }

      // Unlabeled interactive elements
      if (screenReaderResult.unlabeled_interactive_elements > 0) {
        await prisma.aiVisualFinding.create({
          data: {
            reviewRunId,
            siteId,
            pageId,
            criterionId: "4.1.2",
            criterionName: "Name, Role, Value",
            level: "A",
            status: "fail",
            confidence: 0.9,
            severity: "serious",
            description: `${screenReaderResult.unlabeled_interactive_elements} interactive element(s) without accessible name`,
            selector: screenReaderResult.unlabeled_selectors
              .slice(0, 5)
              .join(", "),
            source: "screen_reader",
            action: "auto_create",
            metadata: {
              unlabeledSelectors: screenReaderResult.unlabeled_selectors,
            },
          },
        });
        findingsCreated++;
        highConfidence++;
      }
    } finally {
      await context.close();
    }

    return {
      findingsCreated,
      highConfidence,
      needsReview,
      latencyMs: Date.now() - startTime,
      tokensUsed,
    };
  }
}
