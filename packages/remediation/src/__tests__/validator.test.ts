import { describe, it, expect } from 'vitest';
import { validateFix } from '../validator';

describe('validateFix', () => {
  it('validates clean HTML', () => {
    const result = validateFix('<img src="/logo.png" alt="Logo">');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects script injection', () => {
    const result = validateFix('<img src="x" onerror="alert(1)">');
    expect(result.valid).toBe(false);
    expect(result.checks.noScriptInjection).toBe(false);
  });

  it('detects javascript: protocol', () => {
    const result = validateFix('<a href="javascript:void(0)">Click</a>');
    expect(result.valid).toBe(false);
  });

  it('warns about unbalanced tags', () => {
    const result = validateFix('<div><span>text</div>');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.checks.syntaxValid).toBe(false);
  });

  it('warns about placeholder text', () => {
    const result = validateFix('<button aria-label="[Action description]">Click</button>');
    expect(result.warnings).toContain('Code contains placeholder text that needs human review');
  });

  it('warns about invalid ARIA with role=none', () => {
    const result = validateFix('<div role="none" aria-label="test">content</div>');
    expect(result.checks.noInvalidAria).toBe(false);
  });

  it('accepts self-closing tags', () => {
    const result = validateFix('<img src="a.png" alt="test" />');
    expect(result.valid).toBe(true);
    expect(result.checks.syntaxValid).toBe(true);
  });
});
