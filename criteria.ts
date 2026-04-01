/**
 * WCAG 2.2 criteria that can be assessed via visual analysis.
 * Each entry includes the prompt segment for the vision model.
 */
export const VISUAL_WCAG_CRITERIA = [
  {
    id: "1.4.3",
    name: "Contrast (Minimum)",
    level: "AA",
    prompt:
      "Check text contrast ratios. Light text on light backgrounds or dark text on dark backgrounds may fail the 4.5:1 minimum (3:1 for large text).",
  },
  {
    id: "1.4.11",
    name: "Non-text Contrast",
    level: "AA",
    prompt:
      "Check UI component boundaries (buttons, inputs, icons) for sufficient contrast against their background (minimum 3:1).",
  },
  {
    id: "2.4.7",
    name: "Focus Visible",
    level: "AA",
    prompt:
      "Check if interactive elements would have visible focus indicators. Look for outline:none without replacement, or custom styles that might hide focus.",
  },
  {
    id: "1.4.12",
    name: "Text Spacing",
    level: "AA",
    prompt:
      "Assess if the layout would break if line-height is set to 1.5x, letter-spacing to 0.12em, word-spacing to 0.16em, and paragraph spacing to 2x font size.",
  },
  {
    id: "1.4.10",
    name: "Reflow",
    level: "AA",
    prompt:
      "Assess if content would reflow properly at 400% zoom (320px equivalent width). Look for horizontal overflow risks.",
  },
  {
    id: "1.4.13",
    name: "Content on Hover or Focus",
    level: "AA",
    prompt:
      "Identify elements that might show tooltips, dropdowns, or popups on hover. Check if such content would be dismissible, hoverable, and persistent.",
  },
  {
    id: "2.5.3",
    name: "Label in Name",
    level: "A",
    prompt:
      "Check if visible text labels on buttons and links match what would be the accessible name. Icons with visible labels should have the label as part of their accessible name.",
  },
  {
    id: "1.4.1",
    name: "Use of Color",
    level: "A",
    prompt:
      "Check if color is the sole means of conveying information (e.g., red for error, green for success) without additional visual indicators.",
  },
  {
    id: "1.3.3",
    name: "Sensory Characteristics",
    level: "A",
    prompt:
      "Check if instructions rely on shape, size, visual location, orientation, or sound (e.g., 'click the round button', 'see the menu on the right').",
  },
  {
    id: "3.2.3",
    name: "Consistent Navigation",
    level: "AA",
    prompt:
      "Check if navigation elements appear in a consistent location and order relative to other pages on the site.",
  },
  {
    id: "3.3.1",
    name: "Error Identification",
    level: "A",
    prompt:
      "Check form elements for clear error indication. Are error messages visible, specific, and associated with the relevant field?",
  },
  {
    id: "4.1.2",
    name: "Name, Role, Value",
    level: "A",
    prompt:
      "Check custom UI components (sliders, tabs, accordions) for proper ARIA roles and states that would convey their purpose to assistive technology.",
  },
];