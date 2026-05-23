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
  // Decode HTML entities to catch obfuscated payloads like java&#x0A;script:
  const decodedCode = code.replace(/&#(?:x([\da-f]+)|(\d+));?/gi, (_, hex, dec) => {
    return String.fromCharCode(dec ? parseInt(dec, 10) : parseInt(hex, 16));
  });

  // Strip control characters and whitespace for protocol matching
  // This catches things like "j a v a s c r i p t :" or "java\x00script:"
  const strippedCode = decodedCode.replace(/[\u0000-\u0020\u007F-\u009F\u2000-\u200F\u2028-\u202F\u205F-\u206F\u3000\uFEFF]/g, '');

  const generalPatterns = [
    /<script/i,
    /<object/i,
    /<embed/i,
    /<iframe/i,
    /\bon\w+\s*=/i,
    /eval\s*\(/i,
    /setTimeout\s*\(/i,
    /setInterval\s*\(/i,
    /document\.write/i,
    /innerHTML\s*=/i,
  ];

  const protocolPatterns = [
    /javascript:/i,
    /vbscript:/i,
    /data:text\/html/i,
  ];

  return (
    generalPatterns.some((p) => p.test(decodedCode)) ||
    protocolPatterns.some((p) => p.test(strippedCode))
  );
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
