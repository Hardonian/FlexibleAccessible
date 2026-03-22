import { describe, it, expect } from 'vitest';
import { buildPaginationMeta, paginationSchema } from '../pagination';

describe('buildPaginationMeta', () => {
  it('calculates total pages correctly', () => {
    const meta = buildPaginationMeta(1, 20, 100);
    expect(meta.totalPages).toBe(5);
  });

  it('sets hasNext correctly', () => {
    expect(buildPaginationMeta(1, 20, 100).hasNext).toBe(true);
    expect(buildPaginationMeta(5, 20, 100).hasNext).toBe(false);
  });

  it('sets hasPrev correctly', () => {
    expect(buildPaginationMeta(1, 20, 100).hasPrev).toBe(false);
    expect(buildPaginationMeta(2, 20, 100).hasPrev).toBe(true);
  });

  it('handles zero total', () => {
    const meta = buildPaginationMeta(1, 20, 0);
    expect(meta.totalPages).toBe(0);
    expect(meta.hasNext).toBe(false);
  });
});

describe('paginationSchema', () => {
  it('parses valid pagination params', () => {
    const result = paginationSchema.parse({ page: '2', limit: '50' });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(50);
  });

  it('applies defaults', () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('rejects invalid page numbers', () => {
    expect(() => paginationSchema.parse({ page: '0' })).toThrow();
    expect(() => paginationSchema.parse({ page: '-1' })).toThrow();
  });

  it('caps limit at 100', () => {
    expect(() => paginationSchema.parse({ limit: '200' })).toThrow();
  });
});
