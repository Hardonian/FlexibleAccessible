import { Job } from 'bullmq';
import { prisma } from '@aros/db';
import type { SuggestionType } from '@aros/db';
import { checkAiEntitlement, logAiUsage } from '@aros/shared';

interface RemediationJobData {
  findingId: string;
  clusterId?: string;
  siteId: string;
}

export async function handleRemediationJob(job: Job<RemediationJobData>) {
  const { findingId, clusterId } = job.data;

  console.log(`[Remediation] Generating suggestion for finding ${findingId}`);

  const finding = await prisma.canonicalFinding.findUnique({
    where: { id: findingId },
    include: {
      occurrences: {
        take: 5,
        include: { page: { select: { url: true } } },
      },
      site: {
        include: {
          workspace: {
            select: { organizationId: true },
          },
        },
      },
    },
  });

  if (!finding) {
    console.warn(`[Remediation] Finding ${findingId} not found`);
    return;
  }

  const organizationId = finding.site.workspace.organizationId;

  // ─── MONETIZATION GUARDRAIL: CHECK AI ENTITLEMENT ─────────────────
  const entitlement = await checkAiEntitlement(prisma, organizationId);
  if (!entitlement.allowed) {
    console.warn(`[Remediation] AI Usage blocked for org ${organizationId}: ${entitlement.reason}`);
    return;
  }

  const firstOccurrence = finding.occurrences[0];
  if (!firstOccurrence) {
    console.warn(`[Remediation] No occurrences for finding ${findingId}`);
    return;
  }

  const elementHtml = firstOccurrence.elementHtml;
  const ruleId = finding.ruleId;

  // Generate suggestion using rule-based logic
  // In production, this would call an AI service for more complex suggestions
  const suggestion = generateSuggestion(ruleId, elementHtml, finding.description);

  if (!suggestion) {
    console.log(`[Remediation] No suggestion generated for ${ruleId}`);
    return;
  }

  // Validate the suggestion
  const validation = validateSuggestion(suggestion.suggestedCode, suggestion.type);

  const status = validation.valid ? 'VALIDATED' : 'FAILED_VALIDATION';

  await prisma.remediationSuggestion.create({
    data: {
      canonicalFindingId: findingId,
      clusterId: clusterId ?? null,
      type: suggestion.type,
      status,
      originalCode: elementHtml,
      suggestedCode: suggestion.suggestedCode,
      rationale: suggestion.rationale,
      confidence: suggestion.confidence,
      validationResult: validation as object,
    },
  });

  // ─── LOG AI USAGE FOR BILLING ──────────────────────────────────────
  // Mock token counts for now (based on input/output length)
  const inputTokens = Math.ceil(elementHtml.length / 4);
  const outputTokens = Math.ceil(suggestion.suggestedCode.length / 4);

  await logAiUsage(prisma, {
    organizationId,
    model: 'rule-based', // Use 'rule-based' for the current mocked logic
    promptTokens: inputTokens,
    completionTokens: outputTokens,
    purpose: 'REMEDIATION_SUGGESTION',
  });

  // If confidence is below threshold, create a review task
  if (suggestion.confidence < 0.7 || !validation.valid) {
    await prisma.reviewTask.create({
      data: {
        type: 'SUGGESTION_REVIEW',
        status: 'PENDING',
        title: `Review: ${suggestion.type.toLowerCase().replace('_', ' ')} suggestion`,
        description: `AI-generated suggestion for "${finding.description}" needs human review. Confidence: ${Math.round(suggestion.confidence * 100)}%.`,
      },
    });
  }

  console.log(`[Remediation] Suggestion created for finding ${findingId} (${status})`);
}

interface SuggestionResult {
  type: SuggestionType;
  suggestedCode: string;
  rationale: string;
  confidence: number;
}

function generateSuggestion(
  ruleId: string,
  elementHtml: string,
  description: string
): SuggestionResult | null {
  // Rule-based suggestion generation
  // Each handler tries to generate the most appropriate fix

  switch (ruleId) {
    case 'image-alt': {
      // Missing alt text
      const imgMatch = elementHtml.match(/<img([^>]*)>/);
      if (imgMatch) {
        const attrs = imgMatch[1];
        const src = attrs.match(/src="([^"]*)"/)?.[1] ?? '';
        const filename = src.split('/').pop()?.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') ?? '';
        const suggestedAlt = filename || 'Descriptive alt text needed';

        let suggestedCode = elementHtml;
        if (attrs.includes('alt=""') || attrs.includes("alt=''")) {
          suggestedCode = elementHtml.replace(/alt=["'][^"']*["']/, `alt="${suggestedAlt}"`);
        } else if (!attrs.includes('alt=')) {
          suggestedCode = elementHtml.replace(/<img/, `<img alt="${suggestedAlt}"`);
        }

        return {
          type: 'ALT_TEXT',
          suggestedCode,
          rationale: `Image is missing meaningful alt text. Added descriptive alt text derived from the filename. Review and refine the alt text to accurately describe the image content and purpose. If the image is decorative, use alt="" instead.`,
          confidence: 0.5, // Low confidence since alt text needs human review
        };
      }
      break;
    }

    case 'button-name': {
      // Button without accessible name
      const hasIcon = elementHtml.includes('<svg') || elementHtml.includes('<i ') || elementHtml.includes('icon');
      if (hasIcon) {
        const suggestedCode = elementHtml.replace(
          /<button/,
          '<button aria-label="[Action description]"'
        );
        return {
          type: 'BUTTON_LABEL',
          suggestedCode,
          rationale: 'Icon-only button needs an accessible name. Added aria-label attribute. However, prefer using visible text alongside the icon when possible, as visible text benefits all users.',
          confidence: 0.6,
        };
      }
      // Empty button
      const suggestedCode = elementHtml.replace(
        /<button([^>]*)><\/button>/,
        '<button$1>[Button text]</button>'
      );
      return {
        type: 'BUTTON_LABEL',
        suggestedCode,
        rationale: 'Button has no text content or accessible name. Added placeholder text. Replace with a meaningful label that describes the button action.',
        confidence: 0.4,
      };
    }

    case 'link-name': {
      const suggestedCode = elementHtml.includes('<a')
        ? elementHtml.replace(/<a([^>]*)>(\s*)<\/a>/, '<a$1>[Link text]</a>')
        : elementHtml;
      return {
        type: 'LINK_TEXT',
        suggestedCode,
        rationale: 'Link has no discernible text. Add meaningful link text that describes the destination or purpose.',
        confidence: 0.4,
      };
    }

    case 'label': {
      const inputMatch = elementHtml.match(/<input([^>]*)>/);
      if (inputMatch) {
        const type = inputMatch[1].match(/type="([^"]*)"/)?.[1] ?? 'text';
        const name = inputMatch[1].match(/name="([^"]*)"/)?.[1] ?? '';
        const labelText = name.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || `${type} input`;

        const suggestedCode = `<label for="${name}">${labelText}</label>\n${elementHtml}`;
        return {
          type: 'FORM_LABEL',
          suggestedCode,
          rationale: `Form input is missing an associated label element. Added a <label> element with the for attribute. Using a native <label> element is preferred over aria-label as it benefits all users.`,
          confidence: 0.7,
        };
      }
      break;
    }

    case 'heading-order': {
      const headingMatch = elementHtml.match(/<(h[1-6])/);
      if (headingMatch) {
        const current = parseInt(headingMatch[1][1]);
        const suggested = Math.max(current - 1, 1);
        const suggestedCode = elementHtml
          .replace(new RegExp(`<h${current}`), `<h${suggested}`)
          .replace(new RegExp(`</h${current}>`), `</h${suggested}>`);
        return {
          type: 'HEADING_FIX',
          suggestedCode,
          rationale: `Heading level skips (h${current} appears out of order). Adjusted to h${suggested} to maintain proper heading hierarchy. Review the full page heading structure to ensure logical order.`,
          confidence: 0.6,
        };
      }
      break;
    }

    case 'region':
    case 'landmark-one-main':
    case 'landmark-complementary-is-top-level': {
      return {
        type: 'SEMANTIC_HTML',
        suggestedCode: elementHtml,
        rationale: `Page structure issue: ${description}. Consider wrapping content in appropriate landmark elements (<main>, <nav>, <header>, <footer>, <aside>) instead of generic <div> elements.`,
        confidence: 0.5,
      };
    }

    case 'aria-allowed-attr':
    case 'aria-valid-attr':
    case 'aria-valid-attr-value': {
      // Remove invalid ARIA attributes
      const suggestedCode = elementHtml.replace(
        /\s*aria-[a-z-]+="[^"]*"/g,
        (match) => {
          // Keep valid, commonly used ARIA attributes
          if (/aria-(label|labelledby|describedby|hidden|expanded|pressed|checked|selected|disabled|required|invalid|live|atomic|relevant|busy)=/.test(match)) {
            return match;
          }
          return '';
        }
      );
      return {
        type: 'ARIA_CLEANUP',
        suggestedCode: suggestedCode.replace(/\s+/g, ' '),
        rationale: `Element has invalid or misused ARIA attributes. Removed potentially problematic ARIA usage. Prefer native HTML semantics over ARIA where possible.`,
        confidence: 0.6,
      };
    }

    case 'color-contrast': {
      return {
        type: 'COLOR_CONTRAST',
        suggestedCode: elementHtml,
        rationale: `Element has insufficient color contrast. The foreground and background colors do not meet WCAG AA minimum contrast ratio of 4.5:1 for normal text (3:1 for large text). Adjust the colors to meet the required ratio.`,
        confidence: 0.3, // Low confidence - needs visual review
      };
    }
  }

  // Generic suggestion for unhandled rules
  return {
    type: 'CUSTOM_SNIPPET',
    suggestedCode: elementHtml,
    rationale: `Accessibility issue detected: ${description}. Manual review required to determine the appropriate fix.`,
    confidence: 0.2,
  };
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function validateSuggestion(
  suggestedCode: string,
  type: SuggestionType
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic HTML/JSX syntax check
  const openTags = (suggestedCode.match(/<[a-zA-Z][^>]*(?<!\/)>/g) ?? []).length;
  const closeTags = (suggestedCode.match(/<\/[a-zA-Z][^>]*>/g) ?? []).length;
  const selfClosing = (suggestedCode.match(/<[a-zA-Z][^>]*\/>/g) ?? []).length;

  // Very rough balance check
  if (openTags - selfClosing !== closeTags && closeTags > 0) {
    warnings.push('HTML tag balance may be incorrect');
  }

  // Check for dangerous patterns
  if (suggestedCode.includes('javascript:')) {
    errors.push('Suggested code contains javascript: protocol');
  }
  if (suggestedCode.includes('onclick=') || suggestedCode.includes('onload=')) {
    warnings.push('Suggested code contains inline event handlers');
  }

  // Check for invalid ARIA patterns
  if (type === 'ARIA_CLEANUP') {
    if (suggestedCode.includes('role="none"') && suggestedCode.includes('aria-')) {
      warnings.push('Element with role="none" should not have other ARIA attributes');
    }
  }

  // Check placeholder text wasn't left in
  if (suggestedCode.includes('[') && suggestedCode.includes(']')) {
    warnings.push('Suggested code may contain placeholder text that needs replacement');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
