import type { WcagChunk } from "./chunker";
import { searchKnowledge, getKnowledgeForRule } from "./vector-store";

export interface RAGFixResult {
  fix: string;
  rationale: string;
  confidence: number;
  sources: Array<{ criterionId: string; techniqueId: string; type: string }>;
  relevantTechniques: string[];
}

/**
 * RAG-augmented remediation engine.
 * Retrieves relevant WCAG knowledge before generating fixes,
 * grounding suggestions in authoritative W3C techniques.
 */
export function ragAugmentedFix(
  ruleId: string,
  elementHtml: string,
  description: string,
): RAGFixResult | null {
  // Get relevant WCAG knowledge for this rule
  const ruleChunks = getKnowledgeForRule(ruleId);

  // Also search for contextually relevant chunks
  const searchResults = searchKnowledge(
    `${ruleId} ${description} ${elementHtml}`,
    5,
    0.2,
  );

  // Merge and deduplicate
  const allChunks = new Map<string, WcagChunk>();
  for (const chunk of ruleChunks) {
    allChunks.set(chunk.id, chunk);
  }
  for (const result of searchResults) {
    allChunks.set(result.chunk.id, result.chunk);
  }

  const chunks = Array.from(allChunks.values());

  // Extract sufficient techniques
  const sufficientTechniques = chunks
    .filter(
      (c) =>
        c.metadata.section?.includes("Sufficient") ||
        c.text.includes("Sufficient Technique"),
    )
    .map((c) => c.text);

  // Extract common failures to avoid
  const commonFailures = chunks
    .filter(
      (c) =>
        c.metadata.section?.includes("Failure") ||
        c.text.includes("Common Failure"),
    )
    .map((c) => c.text);

  // Build source citations
  const sources = chunks
    .filter((c) => c.metadata.criterionId)
    .map((c) => ({
      criterionId: c.metadata.criterionId!,
      techniqueId: c.metadata.section ?? "",
      type: "wcag-criterion",
    }));

  // Generate fix using the knowledge
  const fix = generateFixFromKnowledge(
    ruleId,
    elementHtml,
    sufficientTechniques,
    commonFailures,
  );

  if (!fix) return null;

  return {
    fix: fix.code,
    rationale: fix.rationale,
    confidence: fix.confidence,
    sources,
    relevantTechniques: sufficientTechniques.map(
      (t) => t.split("\n")[0] ?? t.slice(0, 100),
    ),
  };
}

interface KnowledgeFix {
  code: string;
  rationale: string;
  confidence: number;
}

function generateFixFromKnowledge(
  ruleId: string,
  elementHtml: string,
  sufficientTechniques: string[],
  commonFailures: string[],
): KnowledgeFix | null {
  const techniqueIds = sufficientTechniques.join(" ");

  switch (ruleId) {
    case "image-alt": {
      const hasAlt = elementHtml.includes("alt=");
      const isEmpty = /alt=["']\s*["']/.test(elementHtml);

      if (!hasAlt) {
        // Per H67: decorative images should use alt=""
        // Per H2/H37: informative images need descriptive alt
        const isDecorative =
          elementHtml.includes("decorative") ||
          elementHtml.includes("spacer") ||
          elementHtml.includes("border") ||
          commonFailures.some((f) => f.includes("F38") || f.includes("F39"));

        if (isDecorative) {
          return {
            code: elementHtml.replace(/<img/, '<img alt=""'),
            rationale:
              'Based on WCAG technique H67: decorative images should use empty alt="" so assistive technology can skip them. The image does not convey information and is purely presentational.',
            confidence: 0.9,
          };
        }

        const src = elementHtml.match(/src="([^"]*)"/)?.[1] ?? "";
        const filename =
          src
            .split("/")
            .pop()
            ?.replace(/\.[^.]+$/, "")
            .replace(/[-_]/g, " ") ?? "descriptive image";

        return {
          code: elementHtml.replace(/<img/, `<img alt="${filename}"`),
          rationale: `Based on WCAG techniques H2/H37/G94: images must have text alternatives that serve the same purpose. Added alt text derived from filename. Per SC 1.1.1, review and refine to accurately describe the image content and function. If decorative, use alt="" instead.`,
          confidence: 0.5,
        };
      }

      if (isEmpty) {
        // F39 failure: non-decorative image with empty alt
        return {
          code: elementHtml.replace(
            /alt=["']\s*["']/,
            'alt="[Describe image content]"',
          ),
          rationale:
            "Based on failure F39: this image appears to be informational but has empty alt text. Per SC 1.1.1, informative images must have descriptive alternatives.",
          confidence: 0.4,
        };
      }
      break;
    }

    case "button-name": {
      // Per WCAG 4.1.2: interactive elements need accessible names
      if (
        !elementHtml.match(/>([^<]+)</) &&
        !elementHtml.includes("aria-label")
      ) {
        if (elementHtml.includes("<svg") || elementHtml.includes("icon")) {
          return {
            code: elementHtml.replace(
              /<button/,
              '<button aria-label="[Describe action]"',
            ),
            rationale:
              "Based on technique G108/H65: icon-only buttons need accessible names via aria-label. The button role is conveyed by the HTML element, but without text content, screen readers cannot announce its purpose. Prefer adding visible text alongside the icon when possible.",
            confidence: 0.6,
          };
        }
        return {
          code: elementHtml.replace(
            /<button([^>]*)><\/button>/,
            "<button$1>[Button action]</button>",
          ),
          rationale:
            "Based on SC 4.1.2 (Name, Role, Value): the button element conveys role automatically, but needs an accessible name via text content. Empty buttons cannot be understood by assistive technology users.",
          confidence: 0.5,
        };
      }
      break;
    }

    case "label": {
      // Per H44: form controls need associated label elements
      const inputMatch = elementHtml.match(/<input([^>]*)>/);
      if (inputMatch) {
        const name = inputMatch[1].match(/name="([^"]*)"/)?.[1] ?? "field";
        const id = inputMatch[1].match(/id="([^"]*)"/)?.[1] ?? name;
        const labelText = name
          .replace(/[-_]/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());

        const fixedInput = !inputMatch[1].includes("id=")
          ? elementHtml.replace(/<input/, `<input id="${id}"`)
          : elementHtml;

        return {
          code: `<label for="${id}">${labelText}</label>\n${fixedInput}`,
          rationale:
            'Based on techniques H44/H65/G131: form inputs must have associated labels. The <label for=""> pattern is preferred over aria-label because it creates a visible label that benefits all users, provides a larger click target, and is universally supported.',
          confidence: 0.7,
        };
      }
      break;
    }

    case "heading-order": {
      // Per H42: headings should be properly nested
      const headingMatch = elementHtml.match(/<(h[1-6])/);
      if (headingMatch) {
        const level = parseInt(headingMatch[1][1]);
        const suggested = Math.max(level - 1, 1);
        return {
          code: elementHtml
            .replace(new RegExp(`<h${level}`), `<h${suggested}`)
            .replace(new RegExp(`</h${level}>`), `</h${suggested}>`),
          rationale: `Based on technique H42 and SC 1.3.1: heading levels should be nested sequentially without skipping levels. Adjusted h${level} to h${suggested} to maintain proper document structure. Headings create an outline that assistive technology uses for navigation.`,
          confidence: 0.6,
        };
      }
      break;
    }

    case "html-has-lang": {
      // Per H57: html element needs lang attribute
      return {
        code: elementHtml.replace(/<html/, '<html lang="en"'),
        rationale:
          'Based on technique H57 and SC 3.1.1: the language of the page must be programmatically determinable. The lang attribute on <html> enables screen readers to use the correct pronunciation and voice profile. Adjust "en" to the actual page language.',
        confidence: 0.9,
      };
    }

    case "document-title": {
      // Per H25: pages need descriptive titles
      return {
        code: "<title>Page Title</title>",
        rationale:
          "Based on technique H25/G88 and SC 2.4.2: every page must have a title that describes its topic or purpose. The title is the first thing screen readers announce and appears in browser tabs, bookmarks, and search results.",
        confidence: 0.8,
      };
    }

    case "region":
    case "landmark-one-main":
    case "landmark-complementary-is-top-level": {
      // Per G1/H69: use landmark regions
      return {
        code: elementHtml,
        rationale: `Based on techniques G1/G124/H69: page content should be organized into landmark regions (<main>, <nav>, <header>, <footer>, <aside>). Landmarks allow assistive technology users to navigate by section. Ensure exactly one <main> element wraps the primary content.`,
        confidence: 0.5,
      };
    }

    case "color-contrast": {
      return {
        code: elementHtml,
        rationale:
          "Based on techniques G17/G18/G145 and SC 1.4.3: text must have a contrast ratio of at least 4.5:1 against its background (3:1 for large text, 18pt+ or 14pt bold). Use a contrast checker tool to find compliant colors. Consider both light and dark theme contexts.",
        confidence: 0.3,
      };
    }
  }

  return null;
}
