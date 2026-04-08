import { describe, expect, it } from 'vitest';
import { computeScanDelta } from './scan-delta';

describe('computeScanDelta', () => {
  it('returns non-comparable when no previous run exists', () => {
    const result = computeScanDelta(['a', 'b', 'c'], null);
    expect(result).toEqual({
      comparable: false,
      newCount: 3,
      resolvedCount: 0,
      persistingCount: 0,
    });
  });

  it('computes new/resolved/persisting counts', () => {
    const result = computeScanDelta(['a', 'b', 'd'], ['a', 'b', 'c']);
    expect(result).toEqual({
      comparable: true,
      newCount: 1,
      resolvedCount: 1,
      persistingCount: 2,
    });
  });
});
