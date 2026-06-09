import { describe, expect, it } from 'vitest';
import { formatCsvExport, ExportData } from '../export';

describe('formatCsvExport', () => {
  it('formats an empty findings array to just headers', () => {
    const data: ExportData = {
      findings: [],
      generatedAt: '2024-05-23T00:00:00Z',
      generatedBy: 'system',
    };
    const result = formatCsvExport(data);
    expect(result).toBe(
      'Finding ID,Rule,Impact,Status,Description,WCAG Tags,Occurrences,Sample Page,Sample Selector'
    );
  });

  it('formats normal findings correctly', () => {
    const data: ExportData = {
      findings: [
        {
          id: 'f1',
          ruleId: 'r1',
          impact: 'high',
          status: 'open',
          description: 'A finding description',
          wcagTags: ['wcag21a', 'wcag21aa'],
          occurrenceCount: 5,
          pages: [{ url: 'https://example.com', selector: '#main' }],
        },
      ],
      generatedAt: '2024-05-23T00:00:00Z',
      generatedBy: 'system',
    };
    const result = formatCsvExport(data);
    const lines = result.split('\n');
    expect(lines.length).toBe(2);
    expect(lines[1]).toBe(
      'f1,r1,high,open,"A finding description","wcag21a; wcag21aa",5,"https://example.com","#main"'
    );
  });

  it('handles quotes in the description', () => {
    const data: ExportData = {
      findings: [
        {
          id: 'f2',
          ruleId: 'r2',
          impact: 'medium',
          status: 'open',
          description: 'A finding with "quotes" inside',
          wcagTags: [],
          occurrenceCount: 1,
          pages: [{ url: 'https://example.com', selector: '#main' }],
        },
      ],
      generatedAt: '2024-05-23T00:00:00Z',
      generatedBy: 'system',
    };
    const result = formatCsvExport(data);
    const lines = result.split('\n');
    expect(lines[1]).toContain('"A finding with ""quotes"" inside"');
  });

  it('handles findings without pages', () => {
    const data: ExportData = {
      findings: [
        {
          id: 'f3',
          ruleId: 'r3',
          impact: 'low',
          status: 'closed',
          description: 'A finding without pages',
          wcagTags: [],
          occurrenceCount: 0,
          pages: [],
        },
      ],
      generatedAt: '2024-05-23T00:00:00Z',
      generatedBy: 'system',
    };
    const result = formatCsvExport(data);
    const lines = result.split('\n');
    expect(lines[1]).toBe(
      'f3,r3,low,closed,"A finding without pages","",0,,""'
    );
  });
});
