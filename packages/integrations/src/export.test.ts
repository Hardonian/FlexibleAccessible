import { describe, it, expect } from 'vitest';
import { formatCsvExport, formatJsonExport, ExportData } from './export';

describe('export formatters', () => {
  const mockData: ExportData = {
    findings: [
      {
        id: 'f-1',
        ruleId: 'color-contrast',
        impact: 'serious',
        status: 'open',
        description: 'Elements must have sufficient color contrast',
        wcagTags: ['wcag2aa', 'wcag143'],
        occurrenceCount: 2,
        pages: [
          { url: 'https://example.com', selector: '#main > p' }
        ]
      },
      {
        id: 'f-2',
        ruleId: 'image-alt',
        impact: 'critical',
        status: 'resolved',
        description: 'Images must have alternate text',
        wcagTags: ['wcag2a', 'wcag111'],
        occurrenceCount: 1,
        pages: [
          { url: 'https://example.com/about', selector: 'img.logo' }
        ]
      }
    ],
    generatedAt: '2024-05-23T12:00:00Z',
    generatedBy: 'test-user'
  };

  describe('formatJsonExport', () => {
    it('should format data as JSON with a disclaimer', () => {
      const jsonStr = formatJsonExport(mockData);
      const parsed = JSON.parse(jsonStr);

      expect(parsed).toMatchObject({
        generatedAt: mockData.generatedAt,
        generatedBy: mockData.generatedBy,
        disclaimer: 'This export provides evidence of automated accessibility testing. It does not constitute a guarantee of WCAG conformance.'
      });
      expect(parsed.findings).toHaveLength(2);
      expect(parsed.findings[0].id).toBe('f-1');

      // Check formatting: indentation
      expect(jsonStr).toContain('{\n  "findings":');
    });
  });

  describe('formatCsvExport', () => {
    it('should format data as CSV with headers and quoted fields', () => {
      const csvStr = formatCsvExport(mockData);
      const lines = csvStr.split('\n');

      expect(lines).toHaveLength(3); // 1 header + 2 rows

      expect(lines[0]).toBe('Finding ID,Rule,Impact,Status,Description,WCAG Tags,Occurrences,Sample Page,Sample Selector');

      expect(lines[1]).toBe(
        'f-1,color-contrast,serious,open,"Elements must have sufficient color contrast","wcag2aa; wcag143",2,https://example.com,"#main > p"'
      );

      expect(lines[2]).toBe(
        'f-2,image-alt,critical,resolved,"Images must have alternate text","wcag2a; wcag111",1,https://example.com/about,"img.logo"'
      );
    });

    it('should handle findings without pages', () => {
      const dataWithoutPages: ExportData = {
        ...mockData,
        findings: [
          {
            ...mockData.findings[0],
            pages: []
          }
        ]
      };

      const csvStr = formatCsvExport(dataWithoutPages);
      const lines = csvStr.split('\n');

      expect(lines[1]).toBe(
        'f-1,color-contrast,serious,open,"Elements must have sufficient color contrast","wcag2aa; wcag143",2,,""'
      );
    });

    it('should escape quotes in description and selector', () => {
      const dataWithQuotes: ExportData = {
        ...mockData,
        findings: [
          {
            ...mockData.findings[0],
            description: 'Fix "color" contrast',
            pages: [
              { url: 'https://example.com', selector: 'div[data-name="test"]' }
            ]
          }
        ]
      };

      const csvStr = formatCsvExport(dataWithQuotes);
      const lines = csvStr.split('\n');

      expect(lines[1]).toBe(
        'f-1,color-contrast,serious,open,"Fix ""color"" contrast","wcag2aa; wcag143",2,https://example.com,"div[data-name=""test""]"'
      );
    });
  });
});
