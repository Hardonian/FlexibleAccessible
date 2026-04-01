import { describe, it, expect } from "vitest";
import { buildVisionPrompt } from "../prompts.js";
import {
  VISION_PROMPT_SECTIONS,
  A11Y_TREE_MAX_SUMMARY_LENGTH,
} from "../constants.js";
import { VISUAL_WCAG_CRITERIA } from "../criteria.js";

describe("buildVisionPrompt", () => {
  const baseInput = {
    url: "https://example.com",
    pageTitle: "Example Page",
    accessibilityTreeSummary: "A summary of the accessibility tree.",
    axeViolations: [],
    domSummary: "",
  };

  it("should construct a prompt with no axe violations", () => {
    const input = { ...baseInput, axeViolations: [] };
    const prompt = buildVisionPrompt(input);

    expect(prompt).toContain(VISION_PROMPT_SECTIONS.ROLE);
    expect(prompt).toContain(`- URL: ${input.url}`);
    expect(prompt).toContain(`- Title: ${input.pageTitle}`);
    expect(prompt).toContain(VISION_PROMPT_SECTIONS.AXE_HEADER);
    expect(prompt).toContain(VISION_PROMPT_SECTIONS.NO_AXE_VIOLATIONS);
    expect(prompt).toContain(input.accessibilityTreeSummary);
    expect(prompt).toContain(VISUAL_WCAG_CRITERIA[0].prompt);
  });

  it("should list axe violations when they are present", () => {
    const input = {
      ...baseInput,
      axeViolations: [
        {
          ruleId: "color-contrast",
          impact: "serious" as const,
          selector: "#main",
          description: "Low contrast",
        },
        {
          ruleId: "image-alt",
          impact: "critical" as const,
          selector: "img.logo",
          description: "Missing alt text",
        },
      ],
    };
    const prompt = buildVisionPrompt(input);

    expect(prompt).not.toContain(VISION_PROMPT_SECTIONS.NO_AXE_VIOLATIONS);
    expect(prompt).toContain(
      "- [SERIOUS] color-contrast: Low contrast at #main",
    );
    expect(prompt).toContain(
      "- [CRITICAL] image-alt: Missing alt text at img.logo",
    );
  });

  it("should handle axe violations with unknown impact", () => {
    const input = {
      ...baseInput,
      axeViolations: [
        {
          ruleId: "aria-roles",
          impact: null,
          selector: "[role=button]",
          description: "Invalid role",
        },
      ],
    };
    const prompt = buildVisionPrompt(input);
    expect(prompt).toContain(
      "- [UNKNOWN] aria-roles: Invalid role at [role=button]",
    );
  });

  it("should truncate a long accessibility tree summary", () => {
    const longSummary = "a".repeat(A11Y_TREE_MAX_SUMMARY_LENGTH + 100);
    const input = {
      ...baseInput,
      accessibilityTreeSummary: longSummary,
    };
    const prompt = buildVisionPrompt(input);
    const truncatedSummary = longSummary.slice(0, A11Y_TREE_MAX_SUMMARY_LENGTH);

    expect(prompt).toContain(truncatedSummary);
    expect(prompt).not.toContain(longSummary);
  });

  it("should handle an empty or null accessibility tree summary", () => {
    const input = { ...baseInput, accessibilityTreeSummary: "" };
    const prompt = buildVisionPrompt(input);
    expect(prompt).toContain(`${VISION_PROMPT_SECTIONS.A11Y_TREE_HEADER}\n\n`);
  });
});
