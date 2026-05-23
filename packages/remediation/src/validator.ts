export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checks: {
    syntaxValid: boolean;
    noScriptInjection: boolean;
    noInvalidAria: boolean;
    noPlaceholderText: boolean;
  };
}

/**
 * Validates a suggested fix before it can be exported.
 * Ensures basic safety and correctness.
 */
export function validateFix(suggestedCode: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check for script injection
  const noScriptInjection = !hasScriptInjection(suggestedCode);
  if (!noScriptInjection) {
    errors.push('Suggested code contains potential script injection patterns');
  }

  // 2. Check for balanced HTML tags
  const syntaxValid = hasBalancedTags(suggestedCode);
  if (!syntaxValid) {
    warnings.push('HTML tags may not be properly balanced');
  }

  // 3. Check for invalid ARIA patterns
  const noInvalidAria = !hasInvalidAria(suggestedCode);
  if (!noInvalidAria) {
    warnings.push('Code may contain invalid ARIA attribute usage');
  }

  // 4. Check for placeholder text
  const noPlaceholderText = !hasPlaceholderText(suggestedCode);
  if (!noPlaceholderText) {
    warnings.push('Code contains placeholder text that needs human review');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checks: {
      syntaxValid,
      noScriptInjection,
      noInvalidAria,
      noPlaceholderText,
    },
  };
}

function hasScriptInjection(code: string): boolean {
  // Decode HTML entities (decimal and hex) to prevent evasion
  const decoded = code
    .replace(/&#(\d+);?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  const patterns = [
    /j[\s\x00-\x20]*a[\s\x00-\x20]*v[\s\x00-\x20]*a[\s\x00-\x20]*s[\s\x00-\x20]*c[\s\x00-\x20]*r[\s\x00-\x20]*i[\s\x00-\x20]*p[\s\x00-\x20]*t[\s\x00-\x20]*:/i,
    /v[\s\x00-\x20]*b[\s\x00-\x20]*s[\s\x00-\x20]*c[\s\x00-\x20]*r[\s\x00-\x20]*i[\s\x00-\x20]*p[\s\x00-\x20]*t[\s\x00-\x20]*:/i,
    /d[\s\x00-\x20]*a[\s\x00-\x20]*t[\s\x00-\x20]*a[\s\x00-\x20]*:/i,
    /<script/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /on[a-z]+[\s\x00-\x20]*=/i,
    /eval[\s\x00-\x20]*\(/i,
    /document\.write/i,
    /innerHTML[\s\x00-\x20]*=/i,
  ];
  return patterns.some((p) => p.test(decoded));
}

function hasBalancedTags(code: string): boolean {
  const openTags: string[] = [];
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*\/?>/g;
  const selfClosingTags = new Set([
    'img', 'br', 'hr', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr',
  ]);

  let match;
  while ((match = tagRegex.exec(code)) !== null) {
    const fullMatch = match[0];
    const tagName = match[1].toLowerCase();

    if (selfClosingTags.has(tagName) || fullMatch.endsWith('/>')) continue;
    if (fullMatch.startsWith('</')) {
      if (openTags.length === 0 || openTags[openTags.length - 1] !== tagName) {
        return false;
      }
      openTags.pop();
    } else {
      openTags.push(tagName);
    }
  }

  return openTags.length === 0;
}

function hasInvalidAria(code: string): boolean {
  // Check for role="none" or role="presentation" with other ARIA attributes
  if (/role=["'](none|presentation)["']/.test(code)) {
    const otherAria = code.match(/aria-(?!hidden)[a-z-]+=/g);
    if (otherAria && otherAria.length > 0) return true;
  }

  // Check for aria-label on non-interactive generic elements
  if (/role=["']["']/.test(code) && /aria-label=/.test(code)) {
    return true;
  }

  return false;
}

function hasPlaceholderText(code: string): boolean {
  return /\[[A-Z][a-z].*?\]/.test(code);
}
