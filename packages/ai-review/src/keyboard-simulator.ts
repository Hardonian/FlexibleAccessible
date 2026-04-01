import type { Page } from "playwright";
import type { KeyboardAnalysisResult } from "./types.js";
import {
  KEYBOARD_MAX_TABS,
  KEYBOARD_TAB_DELAY_MS,
  FOCUS_TRAP_THRESHOLD,
} from "./types.js";

/**
 * Simulate keyboard navigation on a page.
 * Records tab order, detects focus traps, checks skip links and focus visibility.
 */
export async function simulateKeyboardFlow(
  page: Page,
): Promise<KeyboardAnalysisResult> {
  const result: KeyboardAnalysisResult = {
    tab_order_recorded: true,
    total_focusable_elements: 0,
    tab_order: [],
    focus_traps_detected: 0,
    focus_trap_selectors: [],
    skip_link_present: false,
    skip_link_target: null,
    focus_visible_issues: 0,
    focus_visible_issue_selectors: [],
  };

  try {
    // Check for skip link before starting tab navigation
    const skipLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a[href^='#']"));
      for (const link of links) {
        const text = (link.textContent ?? "").toLowerCase().trim();
        const href = link.getAttribute("href") ?? "";
        if (
          text.includes("skip") ||
          text.includes("jump") ||
          text.includes("main") ||
          text.includes("content")
        ) {
          return { text: link.textContent?.trim(), href };
        }
      }
      // Also check for visually hidden first link that targets a landmark
      const firstLink = document.querySelector(
        "a[href]:first-of-type",
      ) as HTMLAnchorElement | null;
      if (firstLink) {
        const style = window.getComputedStyle(firstLink);
        if (
          style.position === "absolute" ||
          style.clipPath !== "none" ||
          style.clip !== "auto"
        ) {
          const href = firstLink.getAttribute("href") ?? "";
          if (href.startsWith("#") && href.length > 1) {
            return { text: firstLink.textContent?.trim(), href };
          }
        }
      }
      return null;
    });

    if (skipLink) {
      result.skip_link_present = true;
      result.skip_link_target = skipLink.href;
    }

    // Count focusable elements
    result.total_focusable_elements = await page.evaluate(() => {
      const focusable = document.querySelectorAll(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"], details, summary, audio[controls], video[controls]',
      );
      return focusable.length;
    });

    // Record tab order by pressing Tab repeatedly
    const seenElements = new Set<string>();
    let consecutiveSameElement = 0;
    let lastSelector = "";

    for (let i = 0; i < KEYBOARD_MAX_TABS; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(KEYBOARD_TAB_DELAY_MS);

      const focusedInfo = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;

        // Build a selector for the focused element
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : "";
        const classes = el.className
          ? `.${String(el.className).split(" ").filter(Boolean).join(".")}`
          : "";
        const role = el.getAttribute("role")
          ? `[role="${el.getAttribute("role")}"`
          : "";
        const selector = `${tag}${id}${classes}${role}`;

        // Check focus visibility
        const style = window.getComputedStyle(el);
        const hasOutline =
          style.outlineStyle !== "none" && style.outlineWidth !== "0px";
        const hasBoxShadow = style.boxShadow !== "none";
        const hasBorder =
          style.borderStyle !== "none" && style.borderWidth !== "0px";
        const hasFocusVisible = hasOutline || hasBoxShadow || hasBorder;

        return {
          selector,
          tag,
          hasFocusVisible,
          text: el.textContent?.slice(0, 50) ?? "",
        };
      });

      if (!focusedInfo) {
        // Tab returned to body or nothing focused — might be end of tab order
        break;
      }

      const selectorKey = focusedInfo.selector || `unknown-${i}`;

      // Detect focus trap: same element focused multiple times in a row
      if (selectorKey === lastSelector) {
        consecutiveSameElement++;
        if (consecutiveSameElement >= FOCUS_TRAP_THRESHOLD) {
          if (!result.focus_trap_selectors.includes(selectorKey)) {
            result.focus_traps_detected++;
            result.focus_trap_selectors.push(selectorKey);
          }
          break;
        }
      } else {
        consecutiveSameElement = 0;
      }

      lastSelector = selectorKey;

      if (!seenElements.has(selectorKey)) {
        seenElements.add(selectorKey);
        result.tab_order.push(selectorKey);

        // Track focus visibility issues
        if (!focusedInfo.hasFocusVisible && focusedInfo.tag !== "input") {
          result.focus_visible_issues++;
          result.focus_visible_issue_selectors.push(selectorKey);
        }
      }
    }
  } catch (err) {
    console.warn("[KeyboardSimulator] Error during simulation:", err);
    result.tab_order_recorded = false;
  }

  return result;
}
