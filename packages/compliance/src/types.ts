// Compliance types for VPAT generation and accessibility reporting

export type ConformanceLevel = 'A' | 'AA' | 'AAA';

export interface AccessibilityScan {
  scanId?: string;
  productName: string;
  productVersion?: string;
  vendorName?: string;
  platform?: string;
  conformanceLevel?: ConformanceLevel;
  findings: AccessibilityFinding[];
  remarks?: string;
}

export interface AccessibilityFinding {
  id: string;
  url: string;
  element?: string;
  wcagCriteria: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  help: string;
  impact: string;
  resolved?: boolean;
  timestamp: string;
}

export interface VPATReport {
  reportId: string;
  generatedAt: string;
  productName: string;
  productVersion: string;
  vendorName: string;
  platform: string;
  wcagVersion: string;
  conformanceLevel: ConformanceLevel;
  criteria: WCAGCriteria[];
  summary: string;
  remarks?: string;
  linkedScanId?: string;
}

export interface WCAGCriteria {
  criterion: string;
  supported: boolean;
  notes: string;
  violations?: number;
}

export interface ComplianceExportOptions {
  format: 'html' | 'markdown' | 'json';
  includeTimestamp?: boolean;
  includeScanDetails?: boolean;
}

export type ExportFormat = 'html' | 'markdown' | 'json' | 'xlsx' | 'csv';
