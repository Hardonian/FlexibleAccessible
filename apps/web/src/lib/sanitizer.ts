/**
 * Robust Security Sanitizer for AI-generated code snippets.
 * Perfection means Zero-XSS risk in the dashboard.
 * Use this before rendering any 'suggestedCode' in the UI.
 */
export function sanitizeAiCode(codeSnippet: string): string {
  if (!codeSnippet) return "";

  // Conservative default: treat user/generated code as text by escaping it.
  // This avoids runtime dependency on external sanitizers while preserving
  // deterministic zero-script execution behavior.
  return escapeHtml(codeSnippet);
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
