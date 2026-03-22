import { createHash } from 'crypto';

/**
 * Creates a stable fingerprint for deduplication of accessibility findings.
 * Combines rule ID, normalized selector, and element structure.
 */
export function createFingerprint(parts: {
  ruleId: string;
  selector: string;
  siteId: string;
  elementSignature?: string;
}): string {
  const normalized = normalizeSelector(parts.selector);
  const input = [parts.siteId, parts.ruleId, normalized, parts.elementSignature ?? ''].join('|');
  return createHash('sha256').update(input).digest('hex').slice(0, 32);
}

/**
 * Normalizes a CSS selector by removing dynamic IDs and indices
 * so that equivalent structural selectors produce the same fingerprint.
 */
export function normalizeSelector(selector: string): string {
  return selector
    .replace(/\[id="[^"]*"\]/g, '[id]')
    .replace(/:nth-child\(\d+\)/g, ':nth-child(n)')
    .replace(/:nth-of-type\(\d+\)/g, ':nth-of-type(n)')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Creates a DOM structure fingerprint for component clustering.
 * Captures tag hierarchy and structural attributes without content.
 */
export function createDomFingerprint(htmlSnippet: string): string {
  const tagPattern = /<(\w+)([^>]*)>/g;
  const tags: string[] = [];
  let match;
  while ((match = tagPattern.exec(htmlSnippet)) !== null) {
    const tag = match[1].toLowerCase();
    const attrs = match[2];
    const role = attrs.match(/role="([^"]*)"/)?.[1] ?? '';
    const type = attrs.match(/type="([^"]*)"/)?.[1] ?? '';
    const classAttr = attrs.match(/class="([^"]*)"/)?.[1]?.trim() ?? '';
    const classes = classAttr
      ? classAttr
          .split(/\s+/)
          .filter(Boolean)
          .sort()
          .join(',')
      : '';
    const width = attrs.match(/width="([^"]*)"/)?.[1] ?? '';
    tags.push(
      `${tag}${role ? `[role=${role}]` : ''}${type ? `[type=${type}]` : ''}${classes ? `[c=${classes}]` : ''}${width ? `[w=${width}]` : ''}`
    );
  }
  const structure = tags.join('>');
  return createHash('sha256').update(structure).digest('hex').slice(0, 24);
}

/**
 * Computes similarity between two selectors (0-1 score).
 */
export function selectorSimilarity(a: string, b: string): number {
  const aParts = normalizeSelector(a).split(/\s*>\s*|\s+/);
  const bParts = normalizeSelector(b).split(/\s*>\s*|\s+/);
  const maxLen = Math.max(aParts.length, bParts.length);
  if (maxLen === 0) return 1;
  let matches = 0;
  for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
    if (aParts[i] === bParts[i]) matches++;
  }
  return matches / maxLen;
}
