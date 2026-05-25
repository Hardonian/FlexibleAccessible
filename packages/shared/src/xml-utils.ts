/**
 * Escapes characters for safe inclusion in XML/SVG documents.
 * Crucial for preventing XSS in SVG endpoints where content is returned as image/svg+xml.
 */
export function escapeXml(unsafe: string): string {
  if (typeof unsafe !== 'string') {
    return String(unsafe);
  }
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
