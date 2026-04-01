export interface WcagCriterion {
  id: string;
  name: string;
  level: "A" | "AA" | "AAA";
  prompt: string;
}

export const VISUAL_WCAG_CRITERIA: WcagCriterion[] = [
  {
    id: "1.1.1",
    name: "Non-text Content",
    level: "A",
    prompt:
      "Images and non-text content have appropriate text alternatives or are marked as decorative.",
  },
  {
    id: "1.3.1",
    name: "Info and Relationships",
    level: "A",
    prompt:
      "Information structure (headings, lists, tables) is programmatically determinable and correctly nested.",
  },
  {
    id: "1.4.1",
    name: "Use of Color",
    level: "A",
    prompt:
      "Color alone is not used to convey information. Status indicators, charts, and error states have additional cues.",
  },
  {
    id: "1.4.3",
    name: "Contrast (Minimum)",
    level: "AA",
    prompt:
      "Text has a contrast ratio of at least 4.5:1 (3:1 for large text). UI components have 3:1 contrast with adjacent colors.",
  },
  {
    id: "1.4.4",
    name: "Resize Text",
    level: "AA",
    prompt:
      "Text can be resized up to 200% without loss of functionality or content overlap.",
  },
  {
    id: "1.4.11",
    name: "Non-text Contrast",
    level: "AA",
    prompt:
      "UI components and graphical objects have a 3:1 contrast ratio against adjacent colors.",
  },
  {
    id: "1.4.12",
    name: "Text Spacing",
    level: "AA",
    prompt:
      "Text spacing can be increased without loss of content or functionality (line height 1.5, paragraph spacing 2x, letter spacing 0.12em, word spacing 0.16em).",
  },
  {
    id: "1.4.13",
    name: "Content on Hover or Focus",
    level: "AA",
    prompt:
      "Hover/focus content is dismissible, hoverable, and persistent. Tooltips don't obscure other content.",
  },
  {
    id: "2.1.1",
    name: "Keyboard",
    level: "A",
    prompt:
      "All functionality is available via keyboard. No keyboard traps exist.",
  },
  {
    id: "2.4.1",
    name: "Bypass Blocks",
    level: "A",
    prompt: "Skip navigation links are visible when focused.",
  },
  {
    id: "2.4.3",
    name: "Focus Order",
    level: "A",
    prompt:
      "Focus order follows logical reading order. Modal focus is trapped appropriately.",
  },
  {
    id: "2.4.7",
    name: "Focus Visible",
    level: "AA",
    prompt:
      "Keyboard focus indicator is clearly visible. Custom focus styles are not overridden.",
  },
  {
    id: "2.4.11",
    name: "Focus Not Obscured (Minimum)",
    level: "AA",
    prompt:
      "Focused elements are not entirely hidden by sticky headers, floating buttons, or other overlapping content.",
  },
  {
    id: "3.2.1",
    name: "On Focus",
    level: "A",
    prompt:
      "Components do not automatically change context when they receive focus.",
  },
  {
    id: "3.3.1",
    name: "Error Identification",
    level: "A",
    prompt:
      "Form errors are clearly identified, described to users, and associated with the relevant field.",
  },
];

export const VISION_ANALYSIS_SCHEMA = {
  type: "object",
  required: [
    "page_id",
    "url",
    "overall_score",
    "criteria_status",
    "requires_human_review",
    "human_review_reasons",
  ],
  properties: {
    page_id: { type: "string" },
    url: { type: "string" },
    overall_score: { type: "number", minimum: 0, maximum: 100 },
    criteria_status: {
      type: "array",
      items: {
        type: "object",
        required: [
          "criterion_id",
          "criterion_name",
          "level",
          "status",
          "confidence",
          "issues",
        ],
        properties: {
          criterion_id: { type: "string" },
          criterion_name: { type: "string" },
          level: { type: "string", enum: ["A", "AA", "AAA"] },
          status: {
            type: "string",
            enum: ["pass", "fail", "partial", "not_applicable", "uncertain"],
          },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          issues: {
            type: "array",
            items: {
              type: "object",
              required: ["description", "severity", "selector"],
              properties: {
                description: { type: "string" },
                severity: {
                  type: "string",
                  enum: ["critical", "serious", "moderate", "minor"],
                },
                selector: { type: "string" },
                element_description: { type: "string" },
                suggested_fix: { type: "string" },
                evidence: { type: "string" },
              },
            },
          },
        },
      },
    },
    requires_human_review: { type: "boolean" },
    human_review_reasons: { type: "array", items: { type: "string" } },
  },
};
