/**
 * Extreme Security Sanitizer for AI-generated code snippets.
 * Perfection means Zero-XSS risk in the dashboard.
 * Use this before rendering any 'suggestedCode' in the UI.
 *
 * NOTE: Regex-based sanitization is brittle and should not be considered
 * a complete security solution. For robust protection, use a library like
 * DOMPurify in a browser environment. This sanitizer serves as a
 * strong first-line defense in a server-side context.
 */
export function sanitizeAiCode(codeSnippet: string): string {
  if (!codeSnippet) return "";

  // 1. Strip all <script> tags and their content.
  let sanitized = codeSnippet.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");

  // 2. Strip <style> tags and their content to prevent CSS injection.
  sanitized = sanitized.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");

  // 3. Remove 'on*' event handlers. This handles single, double, or no quotes.
  sanitized = sanitized.replace(/\s+on[a-z]+\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|(?:[^\s>]+))/gi, "");

  // 4. Remove dangerous protocols from attributes like href, src, data, action, formaction.
  sanitized = sanitized.replace(
    /(href|src|data|action|formaction)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
    (match, attr, value) => {
      const cleanValue = value.replace(/^["']|["']$/g, "").trim().toLowerCase();
      if (
        cleanValue.startsWith("javascript:") ||
        cleanValue.startsWith("data:") ||
        cleanValue.startsWith("vbscript:") ||
        cleanValue.startsWith("file:")
      ) {
        return `${attr}="#"`;
      }
      return match;
    },
  );

  // 5. Remove other potentially dangerous tags completely.
  sanitized = sanitized.replace(/<\/?(iframe|object|embed|form|base|meta|link|applet|math)\b[^>]*>/gi, "");

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
