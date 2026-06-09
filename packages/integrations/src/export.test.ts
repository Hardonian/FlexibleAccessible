import { describe, it, expect } from 'vitest';
import { formatCsvExport, formatJsonExport, type ExportData } from './export.js';

describe('export utilities', () => {
  const mockData: ExportData = {
    generatedAt: '2024-05-23T00:00:00.000Z',
    generatedBy: 'test-user',
    findings: [
      {
        id: 'find-1',
        ruleId: 'color-contrast',
        impact: 'serious',
        status: 'open',
        description: 'Elements must have sufficient color contrast',
        wcagTags: ['wcag2aa', 'wcag143'],
        occurrenceCount: 3,
        pages: [{ url: 'https://example.com', selector: '#main-nav' }],
      },
      {
        id: 'find-2',
        ruleId: 'image-alt',
        impact: 'critical',
        status: 'resolved',
        description: 'Images must have text alternatives',
        wcagTags: ['wcag2a', 'wcag111'],
        occurrenceCount: 1,
        pages: [], // no pages
      },
      {
        id: 'find-3',
        ruleId: 'aria-roles',
        impact: 'moderate',
        status: 'open',
        description: 'Elements with ARIA roles must use a valid, non-abstract ARIA role. Quote: "test"',
        wcagTags: [],
        occurrenceCount: 2,
        pages: [{ url: 'https://example.com/about', selector: '.foo[data-test="bar"]' }],
      }
    ],
  };

  describe('formatCsvExport', () => {
    it('should format a standard finding correctly', () => {
      const csv = formatCsvExport({ ...mockData, findings: [mockData.findings[0]] });
      const rows = csv.split('\n');
      expect(rows.length).toBe(2);
      expect(rows[0]).toBe('Finding ID,Rule,Impact,Status,Description,WCAG Tags,Occurrences,Sample Page,Sample Selector');
      expect(rows[1]).toBe('find-1,color-contrast,serious,open,"Elements must have sufficient color contrast","wcag2aa; wcag143",3,https://example.com,"#main-nav"');
    });

    it('should handle findings with no pages', () => {
      const csv = formatCsvExport({ ...mockData, findings: [mockData.findings[1]] });
      const rows = csv.split('\n');
      expect(rows.length).toBe(2);
      expect(rows[1]).toBe('find-2,image-alt,critical,resolved,"Images must have text alternatives","wcag2a; wcag111",1,,""');
    });

    it('should escape double quotes in descriptions and selectors', () => {
      const csv = formatCsvExport({ ...mockData, findings: [mockData.findings[2]] });
      const rows = csv.split('\n');
      expect(rows.length).toBe(2);
      // Description quote "test" should become ""test"" inside the quoted field.
      // Selector .foo[data-test="bar"] should become .foo[data-test=""bar""] inside the quoted field.
      expect(rows[1]).toBe('find-3,aria-roles,moderate,open,"Elements with ARIA roles must use a valid, non-abstract ARIA role. Quote: ""test""","",2,https://example.com/about,".foo[data-test=""bar""]"');
    });

    it('should handle empty findings list', () => {
      const csv = formatCsvExport({ ...mockData, findings: [] });
      const rows = csv.split('\n');
      expect(rows.length).toBe(1);
      expect(rows[0]).toBe('Finding ID,Rule,Impact,Status,Description,WCAG Tags,Occurrences,Sample Page,Sample Selector');
    });
  });

  describe('formatJsonExport', () => {
    it('should include all data and append a disclaimer', () => {
      const jsonStr = formatJsonExport(mockData);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.generatedAt).toBe(mockData.generatedAt);
      expect(parsed.generatedBy).toBe(mockData.generatedBy);
      expect(parsed.findings).toEqual(mockData.findings);
      expect(parsed.disclaimer).toBe('This export provides evidence of automated accessibility testing. It does not constitute a guarantee of WCAG conformance.');
    });
  });
});
