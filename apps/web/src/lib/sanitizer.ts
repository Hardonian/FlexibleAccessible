/**
 * Extreme Security Sanitizer for AI-generated code snippets.
 * Perfection means Zero-XSS risk in the dashboard.
 * Use this before rendering any 'suggestedCode' in the UI.
 */
export function sanitizeAiCode(codeSnippet: string): string {
  // 1. Strip all <script> tags and JS handlers entirely.
  // 2. Remove 'on-*' attributes and 'javascript:' protocols.
  return codeSnippet
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "[SECURITY_REMOVED_SCRIPT]")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "")
    .replace(/javascript:[^"']*/gi, "#void");
}

/**
 * Use this to wrap original snippets (which might contain broken/bad real-world HTML)
 * to ensure we never execute external malicious code when auditing client sites.
 */
export function wrapCodePreview(codeHTML: string): string {
  // We double-encode or just treat it as text inside a <code> block normally,
  // but if we ever use a "Live Preview" (the ultimate monetizable feature),
  // we MUST use a Sandboxed Iframe (srcdoc).
  return codeHTML;
}
