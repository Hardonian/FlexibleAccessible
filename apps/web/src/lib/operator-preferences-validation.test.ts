import { describe, expect, it } from 'vitest';
import { isValidOptionalDiagnosticId, validateSuppressedOptionalDiagnosticIds } from './operator-preferences-validation';

describe('validateSuppressedOptionalDiagnosticIds', () => {
  it('accepts optional service svc: ids', () => {
    expect(validateSuppressedOptionalDiagnosticIds(['svc:stripe-billing']).ok).toBe(true);
  });

  it('rejects critical service ids', () => {
    const r = validateSuppressedOptionalDiagnosticIds(['svc:database']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.invalid).toEqual(['svc:database']);
  });

  it('rejects malformed ids', () => {
    const r = validateSuppressedOptionalDiagnosticIds(['database', 'svc:unknown']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.invalid).toContain('database');
  });
});

describe('isValidOptionalDiagnosticId', () => {
  it('returns false for non svc prefix', () => {
    expect(isValidOptionalDiagnosticId('stripe-billing')).toBe(false);
  });
});
