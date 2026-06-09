import { describe, it, expect } from 'vitest';
import { formatCsvExport, ExportData } from '../export';

describe('formatCsvExport', () => {
  it('returns only headers when findings array is empty', () => {
    const data: ExportData = {
      findings: [],
      generatedAt: new Date().toISOString(),
      generatedBy: 'test-user',
    };

    const expectedHeaders = 'Finding ID,Rule,Impact,Status,Description,WCAG Tags,Occurrences,Sample Page,Sample Selector';
    expect(formatCsvExport(data)).toBe(expectedHeaders);
  });
});
