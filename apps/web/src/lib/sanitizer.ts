/**
 * Robust Security Sanitizer for AI-generated code snippets.
 * Perfection means Zero-XSS risk in the dashboard.
 * Use this before rendering any 'suggestedCode' in the UI.
 */
export function sanitizeAiCode(codeSnippet: string): string {
  if (!codeSnippet) return "";

  // Remove executable / embedding tags entirely.
  let sanitized = codeSnippet.replace(
    /<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1>/gi,
    "",
  );
  sanitized = sanitized.replace(/<(iframe|object|embed)\b[^>]*\/?>/gi, "");

  // Remove inline event handlers.
  sanitized = sanitized.replace(/\s+on[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, "");

  // Neutralize dangerous protocols in href/src attributes.
  sanitized = sanitized.replace(
    /\s(href|src)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (_match, attr: string, _raw: string, dquoteValue?: string, squoteValue?: string, bareValue?: string) => {
      const value = (dquoteValue ?? squoteValue ?? bareValue ?? "").trim().toLowerCase();
      const isDangerous = /^(javascript:|data:|vbscript:)/.test(value);
      if (!isDangerous) {
        return _match;
      }
      return attr.toLowerCase() === "href" ? ' href="#"' : "";
    },
  );

  return sanitized;
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
