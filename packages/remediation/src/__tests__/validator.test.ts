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

  it('detects obfuscated script injection with HTML entities', () => {
    const result = validateFix('<a href="java&#x0A;script:alert(1)">Click</a>');
    expect(result.valid).toBe(false);
  });

  it('detects obfuscated script injection with whitespaces and control characters', () => {
    const result = validateFix('<a href="j a v a s c r i p t :alert(1)">Click</a>');
    expect(result.valid).toBe(false);

    // Test with null byte (simulation)
    const result2 = validateFix('<a href="java\x00script:alert(1)">Click</a>');
    expect(result2.valid).toBe(false);
  });

  it('detects uppercase variations of script injection', () => {
    const result1 = validateFix('<script>EVAL("1")</script>');
    expect(result1.valid).toBe(false);

    const result2 = validateFix('<script>DOCUMENT.WRITE("test")</script>');
    expect(result2.valid).toBe(false);
  });

  it('does not produce false positives for conditional text with equals sign', () => {
    const result = validateFix('<div data-conditional="true">content</div>');
    expect(result.valid).toBe(true);
  });

  it('detects vbscript and other execution methods', () => {
    const result1 = validateFix('<a href="vbscript:msgbox(1)">Click</a>');
    expect(result1.valid).toBe(false);

    const result2 = validateFix('<script>setTimeout("alert(1)", 1000)</script>');
    expect(result2.valid).toBe(false);
  });
});
