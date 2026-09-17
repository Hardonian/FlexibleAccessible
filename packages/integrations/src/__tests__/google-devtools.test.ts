import { describe, it, expect } from "vitest";
import {
  parseLighthouseReport,
  exportToLighthouseAssertions,
  type LighthouseResult,
} from "../google-lighthouse";
import { exportToChromeDevToolsIssues } from "../chrome-devtools";
import { parsePa11yReport, type Pa11yResultItem } from "../foss-pa11y";

describe("Google Lighthouse & Developer Tools Integration", () => {
  it("should parse a Google Lighthouse LHR accessibility report into canonical findings", () => {
    const mockLhr: LighthouseResult = {
      lighthouseVersion: "12.0.0",
      requestedUrl: "https://example.com",
      categories: {
        accessibility: {
          id: "accessibility",
          title: "Accessibility",
          score: 0.85,
          auditRefs: [{ id: "image-alt", weight: 10 }, { id: "color-contrast", weight: 7 }],
        },
      },
      audits: {
        "image-alt": {
          id: "image-alt",
          title: "Image elements do not have [alt] attributes",
          description: "Failing images missing alternative text",
          score: 0,
          details: {
            items: [
              {
                node: {
                  selector: "img.hero-banner",
                  snippet: '<img src="hero.jpg">',
                  nodeLabel: "Hero Banner Image",
                },
              },
            ],
          },
        },
        "color-contrast": {
          id: "color-contrast",
          title: "Background and foreground colors do not have a sufficient contrast ratio.",
          description: "Low contrast ratio",
          score: 0,
          details: {
            items: [
              {
                node: {
                  selector: "button.submit-btn",
                  snippet: "<button>Submit</button>",
                  nodeLabel: "Submit Button",
                },
              },
            ],
          },
        },
      },
    };

    const findings = parseLighthouseReport(mockLhr);
    expect(findings).toHaveLength(2);

    const imageAlt = findings.find((f) => f.ruleId === "image-alt");
    expect(imageAlt).toBeDefined();
    expect(imageAlt?.severity).toBe("critical");
    expect(imageAlt?.selector).toBe("img.hero-banner");
    expect(imageAlt?.wcagCriteria).toContain("WCAG 2.2 1.1.1");
    expect(imageAlt?.source).toBe("google-lighthouse");

    const contrast = findings.find((f) => f.ruleId === "color-contrast");
    expect(contrast).toBeDefined();
    expect(contrast?.severity).toBe("serious");
    expect(contrast?.selector).toBe("button.submit-btn");
  });

  it("should format AROS findings into Google Lighthouse CI (LHCI) assertions", () => {
    const findings = [
      {
        ruleId: "image-alt",
        title: "Missing alt text",
        description: "Image without alt",
        severity: "critical" as const,
        selector: "img",
        source: "google-lighthouse" as const,
      },
    ];

    const lhci = exportToLighthouseAssertions(findings);
    expect(lhci.passed).toBe(false);
    expect(lhci.score).toBe(0.8);
    expect(lhci.assertionResults[0].auditProperty).toBe("categories:accessibility");
    expect(lhci.assertionResults[0].operator).toBe(">=");
  });

  it("should export findings to Google Chrome DevTools Inspector Issue format", () => {
    const findings = [
      {
        ruleId: "button-name",
        title: "Button has no accessible name",
        description: "Button missing label",
        severity: "critical" as const,
        selector: "button#cart",
        snippet: "<button id='cart'>🛒</button>",
        source: "google-lighthouse" as const,
      },
    ];

    const devToolsIssues = exportToChromeDevToolsIssues(findings);
    expect(devToolsIssues).toHaveLength(1);
    expect(devToolsIssues[0].code).toBe("AccessibilityIssue");
    expect(devToolsIssues[0].details.accessibilityIssueDetails.violationType).toBe("button-name");
    expect(devToolsIssues[0].details.accessibilityIssueDetails.element.selector).toBe("button#cart");
  });

  it("should ingest FOSS Pa11y results into canonical findings", () => {
    const pa11yMock: Pa11yResultItem[] = [
      {
        code: "WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail",
        type: "error",
        typeCode: 1,
        message: "This element has insufficient contrast at this confluence.",
        context: "<p class='subtext'>Terms and conditions apply</p>",
        selector: "html > body > p.subtext",
        runner: "htmlcs",
      },
    ];

    const findings = parsePa11yReport(pa11yMock);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe("WCAG2AA.Principle1.Guideline1_4.1_4_3.G18.Fail");
    expect(findings[0].severity).toBe("critical");
    expect(findings[0].selector).toBe("html > body > p.subtext");
    expect(findings[0].source).toBe("foss-pa11y");
  });
});
