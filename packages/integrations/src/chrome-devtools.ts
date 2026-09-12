/**
 * Google Chrome DevTools & Chrome DevTools Protocol (CDP) Issue Exporter
 * Formats AROS accessibility findings into standard Chrome DevTools Inspector Issue schemas.
 */

import type { ConvertedA11yFinding } from "./google-lighthouse";

export interface ChromeDevToolsIssue {
  code: "AccessibilityIssue";
  details: {
    accessibilityIssueDetails: {
      violationType: string;
      element: {
        backendNodeId?: number;
        selector: string;
        nodeName?: string;
      };
      hasDisablingAttribute?: boolean;
      frameId?: string;
    };
  };
}

/**
 * Transforms AROS findings into standard Chrome DevTools Inspector Issues
 */
export function exportToChromeDevToolsIssues(findings: ConvertedA11yFinding[]): ChromeDevToolsIssue[] {
  return findings.map((f) => ({
    code: "AccessibilityIssue",
    details: {
      accessibilityIssueDetails: {
        violationType: f.ruleId,
        element: {
          selector: f.selector,
          nodeName: f.snippet ? f.snippet.slice(0, 30) : undefined,
        },
        hasDisablingAttribute: false,
      },
    },
  }));
}
