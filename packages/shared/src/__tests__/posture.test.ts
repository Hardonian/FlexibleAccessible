import { describe, it, expect } from 'vitest';
import { degradedPosture } from '../posture';

describe('degradedPosture', () => {
  it('creates a degraded posture with required parameters', () => {
    const result = degradedPosture('comp-1', 'Component 1', 'Failed to connect');

    expect(result.overall).toBe('degraded');
    expect(result.summary).toBe('Failed to connect');
    expect(result.reasonCodes).toEqual(['DEGRADED_BY_DESIGN']);
    expect(result.degraded).toBe(true);
    expect(result.degradedReasons).toEqual(['Failed to connect']);
    expect(result.failClosed).toBe(true);
    expect(result.checkedAt).toBeTypeOf('string');

    expect(result.components).toHaveLength(1);
    const component = result.components[0];
    expect(component.id).toBe('comp-1');
    expect(component.name).toBe('Component 1');
    expect(component.level).toBe('degraded');
    expect(component.state).toBe('degraded');
    expect(component.reasonCodes).toEqual(['DEGRADED_BY_DESIGN']);
    expect(component.detail).toBe('Failed to connect');
    expect(component.checkedAt).toBeTypeOf('string');
    expect(component.stale).toBe(false);
  });

  it('uses detail from opts when provided', () => {
    const result = degradedPosture('comp-2', 'Component 2', 'Timeout', {
      detail: 'Connection timed out after 5000ms',
    });

    expect(result.summary).toBe('Timeout');
    expect(result.components[0].detail).toBe('Connection timed out after 5000ms');
  });

  it('generates valid ISO date strings for checkedAt', () => {
    const result = degradedPosture('comp-3', 'Component 3', 'Error');

    expect(() => new Date(result.checkedAt)).not.toThrow();
    expect(() => new Date(result.components[0].checkedAt)).not.toThrow();

    // Check it's an actual valid date, not just a string that doesn't throw
    expect(!isNaN(new Date(result.checkedAt).getTime())).toBe(true);
    expect(!isNaN(new Date(result.components[0].checkedAt).getTime())).toBe(true);
  });

  it('accepts traceId in opts safely', () => {
    const traceId = 'trace-123';
    const result = degradedPosture('comp-4', 'Component 4', 'Error', {
      traceId,
    });

    // The main point is it doesn't throw and still sets up the defaults
    expect(result.summary).toBe('Error');
    expect(result.overall).toBe('degraded');
  });
});
