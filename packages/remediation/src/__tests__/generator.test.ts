import { describe, it, expect } from 'vitest';
import { generateFix } from '../generator';

describe('generateFix', () => {
  it('generates alt text fix for missing alt', () => {
    const result = generateFix({
      ruleId: 'image-alt',
      elementHtml: '<img src="/hero-banner.png">',
      selector: 'section > img',
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('ALT_TEXT');
    expect(result!.suggestedCode).toContain('alt=');
    expect(result!.suggestedCode).toContain('hero banner');
    expect(result!.confidence).toBeGreaterThan(0);
    expect(result!.confidence).toBeLessThanOrEqual(1);
  });

  it('generates button label fix', () => {
    const result = generateFix({
      ruleId: 'button-name',
      elementHtml: '<button class="icon-btn"><svg></svg></button>',
      selector: 'nav > button',
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('BUTTON_LABEL');
    expect(result!.suggestedCode).toContain('aria-label');
  });

  it('generates form label fix', () => {
    const result = generateFix({
      ruleId: 'label',
      elementHtml: '<input type="text" name="first_name" placeholder="First name">',
      selector: 'form > input',
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('FORM_LABEL');
    expect(result!.suggestedCode).toContain('<label');
    expect(result!.prefersSemantic).toBe(true);
  });

  it('generates heading order fix', () => {
    const result = generateFix({
      ruleId: 'heading-order',
      elementHtml: '<h4>Section Title</h4>',
      selector: 'main > section > h4',
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('HEADING_FIX');
    expect(result!.suggestedCode).toContain('<h3');
  });

  it('returns generic suggestion for unknown rules', () => {
    const result = generateFix({
      ruleId: 'unknown-rule',
      elementHtml: '<div>test</div>',
      selector: 'div',
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('CUSTOM_SNIPPET');
    expect(result!.confidence).toBeLessThan(0.5);
  });

  it('prefers semantic HTML solutions', () => {
    const result = generateFix({
      ruleId: 'label',
      elementHtml: '<input type="email" name="email">',
      selector: 'form > input',
    });

    expect(result!.prefersSemantic).toBe(true);
    expect(result!.suggestedCode).toContain('<label');
    expect(result!.rationale).toContain('native');
  });
});
