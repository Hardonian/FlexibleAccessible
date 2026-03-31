import sanitizeHtml from 'sanitize-html';

/**
 * Robust Security Sanitizer for AI-generated code snippets.
 * Perfection means Zero-XSS risk in the dashboard.
 * Use this before rendering any 'suggestedCode' in the UI.
 */
export function sanitizeAiCode(codeSnippet: string): string {
  if (!codeSnippet) return "";

  return sanitizeHtml(codeSnippet, {
    // Allow basic safe HTML elements and common UI/accessibility elements
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img', 'button', 'input', 'label', 'form', 'header', 'nav', 'main', 'footer', 'section', 'article', 'aside', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'svg', 'path'
    ]),
    // Allow global ARIA/data attributes, plus specific semantic attributes
    allowedAttributes: {
      '*': ['class', 'id', 'aria-*', 'data-*', 'role', 'tabindex', 'title', 'lang', 'dir', 'hidden'],
      'a': ['href', 'name', 'target'],
      'img': ['src', 'alt', 'width', 'height'],
      'button': ['type', 'disabled', 'name', 'value'],
      'input': ['type', 'name', 'value', 'placeholder', 'disabled', 'checked', 'readonly', 'required', 'aria-describedby', 'aria-labelledby'],
      'label': ['for'],
      'svg': ['xmlns', 'viewBox', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin'],
      'path': ['d', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']
    },
    // Explicitly deny dangerous schemes
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
    enforceHtmlBoundary: true,
  });
}

/**
 * Escapes special HTML characters to prevent XSS when rendering raw text.
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Use this to wrap original snippets (which might contain broken/bad real-world HTML)
 * to ensure we never execute external malicious code when auditing client sites.
 */
export function wrapCodePreview(codeHTML: string): string {
  if (!codeHTML) return "";
  const escaped = escapeHtml(codeHTML);
  return `<iframe sandbox="allow-same-origin" srcdoc="${escaped}"></iframe>`;
}
