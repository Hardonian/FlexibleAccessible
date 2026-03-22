export interface ExportData {
  findings: Array<{
    id: string;
    ruleId: string;
    impact: string;
    status: string;
    description: string;
    wcagTags: string[];
    occurrenceCount: number;
    pages: Array<{ url: string; selector: string }>;
  }>;
  generatedAt: string;
  generatedBy: string;
}

export function formatCsvExport(data: ExportData): string {
  const headers = [
    'Finding ID',
    'Rule',
    'Impact',
    'Status',
    'Description',
    'WCAG Tags',
    'Occurrences',
    'Sample Page',
    'Sample Selector',
  ];

  const rows = data.findings.map((f) => [
    f.id,
    f.ruleId,
    f.impact,
    f.status,
    `"${f.description.replace(/"/g, '""')}"`,
    `"${f.wcagTags.join('; ')}"`,
    f.occurrenceCount.toString(),
    f.pages[0]?.url ?? '',
    `"${(f.pages[0]?.selector ?? '').replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function formatJsonExport(data: ExportData): string {
  return JSON.stringify(
    {
      ...data,
      disclaimer:
        'This export provides evidence of automated accessibility testing. It does not constitute a guarantee of WCAG conformance.',
    },
    null,
    2
  );
}
