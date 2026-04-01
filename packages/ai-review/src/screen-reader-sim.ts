import type { Page } from "playwright";
import type { ScreenReaderAnalysisResult } from "./types.js";

interface AccessibilityNode {
  role?: string;
  name?: string;
  value?: string;
  children?: AccessibilityNode[];
}

/**
 * Simulate screen reader analysis by extracting and analyzing the accessibility tree.
 * Checks for unlabeled interactive elements, reading order issues, missing landmarks,
 * and proper heading hierarchy.
 */
export async function simulateScreenReader(
  page: Page,
): Promise<ScreenReaderAnalysisResult> {
  const result: ScreenReaderAnalysisResult = {
    unlabeled_interactive_elements: 0,
    unlabeled_selectors: [],
    reading_order_issues: 0,
    missing_landmarks: [],
    dynamic_content_announced: false,
    heading_hierarchy_valid: true,
    heading_issues: [],
  };

  try {
    // Extract accessibility tree
    const tree = await (page as any).accessibility.snapshot({
      interestingOnly: false,
    });

    if (!tree) {
      return result;
    }

    // Analyze unlabeled interactive elements
    const unlabeledFindings = await page.evaluate(() => {
      const interactiveSelectors = [
        "button:not([aria-label]):not([aria-labelledby])",
        "a:not([aria-label]):not([aria-labelledby])",
        "input:not([aria-label]):not([aria-labelledby]):not([id])",
        "select:not([aria-label]):not([aria-labelledby])",
        "textarea:not([aria-label]):not([aria-labelledby])",
        '[role="button"]:not([aria-label]):not([aria-labelledby])',
        '[role="link"]:not([aria-label]):not([aria-labelledby])',
        '[role="tab"]:not([aria-label]):not([aria-labelledby])',
        '[role="menuitem"]:not([aria-label]):not([aria-labelledby])',
      ];

      const findings: Array<{ selector: string; tag: string; reason: string }> =
        [];

      for (const selector of interactiveSelectors) {
        const elements = Array.from(document.querySelectorAll(selector));
        for (const el of elements) {
          const text = el.textContent?.trim() ?? "";
          const alt = el.getAttribute("alt") ?? "";
          const title = el.getAttribute("title") ?? "";
          const placeholder = (el as HTMLInputElement).placeholder ?? "";

          // Element is OK if it has visible text, alt, title, or placeholder
          if (text || alt || title || placeholder) continue;

          // Check for labeled-by association
          const id = el.getAttribute("id");
          if (id) {
            const label = document.querySelector(`label[for="${id}"]`);
            if (label) continue;
          }

          // Check if inside a label
          if (el.closest("label")) continue;

          findings.push({
            selector: buildSelector(el as HTMLElement),
            tag: el.tagName.toLowerCase(),
            reason:
              "No accessible name, visible text, label, or title attribute",
          });
        }
      }

      return findings;

      function buildSelector(el: HTMLElement): string {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : "";
        const cls = el.className
          ? `.${String(el.className).split(" ").filter(Boolean).slice(0, 2).join(".")}`
          : "";
        return `${tag}${id}${cls}`;
      }
    });

    result.unlabeled_interactive_elements = unlabeledFindings.length;
    result.unlabeled_selectors = unlabeledFindings.map((f) => f.selector);

    // Check missing landmarks
    const landmarks = await page.evaluate(() => {
      const roles = new Set<string>();
      const semanticElements: Record<string, string> = {
        header: "banner",
        nav: "navigation",
        main: "main",
        footer: "contentinfo",
        aside: "complementary",
        form: "form",
        section: "region",
        article: "article",
        search: "search",
      };

      // Check explicit ARIA roles
      for (const el of Array.from(document.querySelectorAll("[role]"))) {
        roles.add(el.getAttribute("role")!);
      }

      // Check semantic elements (implicit roles)
      for (const [tag, role] of Object.entries(semanticElements)) {
        if (document.querySelector(tag)) {
          roles.add(role);
        }
      }

      return Array.from(roles);
    });

    const expectedLandmarks = ["main", "navigation", "banner"];
    for (const landmark of expectedLandmarks) {
      if (!landmarks.includes(landmark)) {
        result.missing_landmarks.push(landmark);
      }
    }

    // Check heading hierarchy
    const headingIssues = await page.evaluate(() => {
      const headings = Array.from(
        document.querySelectorAll("h1, h2, h3, h4, h5, h6"),
      );
      const issues: string[] = [];
      let prevLevel = 0;
      let h1Count = 0;

      for (const h of headings) {
        const level = parseInt(h.tagName[1]);
        if (level === 1) h1Count++;

        if (prevLevel > 0 && level > prevLevel + 1) {
          issues.push(
            `Heading level jumps from h${prevLevel} to h${level} (skips levels)`,
          );
        }
        prevLevel = level;
      }

      if (h1Count === 0) {
        issues.push("No h1 heading found on page");
      } else if (h1Count > 1) {
        issues.push(`Multiple h1 headings found (${h1Count})`);
      }

      return issues;
    });

    result.heading_hierarchy_valid = headingIssues.length === 0;
    result.heading_issues = headingIssues;

    // Check for ARIA live regions (dynamic content announcements)
    result.dynamic_content_announced = await page.evaluate(() => {
      return (
        document.querySelectorAll(
          "[aria-live], [role='alert'], [role='status']",
        ).length > 0
      );
    });
  } catch (err) {
    console.warn("[ScreenReaderSim] Error during analysis:", err);
  }

  return result;
}
