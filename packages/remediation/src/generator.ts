export interface FixInput {
  ruleId: string;
  elementHtml: string;
  selector: string;
  context?: string;
}

export interface FixResult {
  type: string;
  suggestedCode: string;
  rationale: string;
  confidence: number;
  prefersSemantic: boolean;
}

/**
 * Generates accessibility fix suggestions using rule-based logic.
 * Prefers native semantic HTML solutions over ARIA-heavy patches.
 */
export function generateFix(input: FixInput): FixResult | null {
  const { ruleId, elementHtml } = input;

  const handlers: Record<string, () => FixResult | null> = {
    'image-alt': () => fixImageAlt(elementHtml),
    'button-name': () => fixButtonName(elementHtml),
    'link-name': () => fixLinkName(elementHtml),
    'label': () => fixFormLabel(elementHtml),
    'heading-order': () => fixHeadingOrder(elementHtml),
    'html-has-lang': () => fixHtmlLang(elementHtml),
    'document-title': () => fixDocumentTitle(elementHtml),
  };

  const handler = handlers[ruleId];
  if (handler) {
    return handler();
  }

  return {
    type: 'CUSTOM_SNIPPET',
    suggestedCode: elementHtml,
    rationale: `Manual review required for rule: ${ruleId}`,
    confidence: 0.1,
    prefersSemantic: true,
  };
}

function fixImageAlt(html: string): FixResult {
  const src = html.match(/src="([^"]*)"/)?.[1] ?? '';
  const filename = src.split('/').pop()?.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') ?? 'image';

  let suggestedCode = html;
  if (!html.includes('alt=')) {
    suggestedCode = html.replace(/<img/, `<img alt="${filename}"`);
  } else if (/alt=["']\s*["']/.test(html)) {
    suggestedCode = html.replace(/alt=["']\s*["']/, `alt="${filename}"`);
  }

  return {
    type: 'ALT_TEXT',
    suggestedCode,
    rationale: 'Image needs descriptive alt text. Added suggestion based on filename. Review and describe what the image communicates to users.',
    confidence: 0.5,
    prefersSemantic: true,
  };
}

function fixButtonName(html: string): FixResult {
  const hasTextContent = /<button[^>]*>([^<]+)</.test(html);
  if (hasTextContent) {
    return {
      type: 'BUTTON_LABEL',
      suggestedCode: html,
      rationale: 'Button appears to have text content. Verify the text is descriptive of the action.',
      confidence: 0.8,
      prefersSemantic: true,
    };
  }

  // Prefer visible text over aria-label when possible
  return {
    type: 'BUTTON_LABEL',
    suggestedCode: html.replace(/<button([^>]*)>/, '<button$1 aria-label="Action description">'),
    rationale: 'Button needs an accessible name. Adding aria-label as a minimum fix. Prefer adding visible text alongside any icon for maximum accessibility.',
    confidence: 0.5,
    prefersSemantic: false,
  };
}

function fixLinkName(html: string): FixResult {
  return {
    type: 'LINK_TEXT',
    suggestedCode: html.replace(/<a([^>]*)>\s*<\/a>/, '<a$1>Link text</a>'),
    rationale: 'Link needs descriptive text content that tells users where the link goes or what it does.',
    confidence: 0.4,
    prefersSemantic: true,
  };
}

function fixFormLabel(html: string): FixResult {
  const inputName = html.match(/name="([^"]*)"/)?.[1] ?? 'field';
  const inputId = html.match(/id="([^"]*)"/)?.[1] ?? inputName;
  const labelText = inputName.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  let suggestedCode = html;
  if (!html.includes('id=')) {
    suggestedCode = html.replace(/<input/, `<input id="${inputId}"`);
  }

  return {
    type: 'FORM_LABEL',
    suggestedCode: `<label for="${inputId}">${labelText}</label>\n${suggestedCode}`,
    rationale: 'Form input needs an associated <label> element. Using native label-for binding instead of aria-label provides better UX for all users.',
    confidence: 0.7,
    prefersSemantic: true,
  };
}

function fixHeadingOrder(html: string): FixResult {
  const match = html.match(/<(h[1-6])/);
  if (!match) {
    return {
      type: 'HEADING_FIX',
      suggestedCode: html,
      rationale: 'Review heading hierarchy to ensure proper nesting order.',
      confidence: 0.3,
      prefersSemantic: true,
    };
  }

  const level = parseInt(match[1][1]);
  const suggested = Math.max(level - 1, 1);

  return {
    type: 'HEADING_FIX',
    suggestedCode: html
      .replace(new RegExp(`<h${level}`), `<h${suggested}`)
      .replace(new RegExp(`</h${level}>`), `</h${suggested}>`),
    rationale: `Heading level h${level} may skip a level. Suggested h${suggested}. Review the full page heading structure.`,
    confidence: 0.6,
    prefersSemantic: true,
  };
}

function fixHtmlLang(html: string): FixResult {
  return {
    type: 'SEMANTIC_HTML',
    suggestedCode: html.replace(/<html/, '<html lang="en"'),
    rationale: 'HTML element needs a lang attribute to help screen readers identify the page language.',
    confidence: 0.9,
    prefersSemantic: true,
  };
}

function fixDocumentTitle(html: string): FixResult {
  return {
    type: 'SEMANTIC_HTML',
    suggestedCode: '<title>Page Title</title>',
    rationale: 'Every page needs a descriptive <title> element. Add a unique, descriptive title.',
    confidence: 0.8,
    prefersSemantic: true,
  };
}
