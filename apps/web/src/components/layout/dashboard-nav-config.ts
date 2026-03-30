import type { MemberRole } from '@aros/db';

export interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  role: MemberRole;
  workspaces: Array<{ id: string; name: string; slug: string }>;
}

export const DASHBOARD_NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/sites', label: 'Sites', icon: 'Globe' },
  { href: '/findings', label: 'Findings', icon: 'AlertTriangle' },
  { href: '/clusters', label: 'Clusters', icon: 'Layers' },
  { href: '/remediation', label: 'Remediation', icon: 'Wrench' },
  { href: '/reviews', label: 'Reviews', icon: 'CheckSquare' },
  { href: '/reports', label: 'Reports', icon: 'FileText' },
  { href: '/settings', label: 'Settings', icon: 'Settings' },
] as const;

export const NAV_ICON_MAP: Record<string, string> = {
  LayoutDashboard: '\u25A0',
  Globe: '\u25CB',
  AlertTriangle: '\u26A0',
  Layers: '\u2630',
  Wrench: '\u2692',
  CheckSquare: '\u2611',
  FileText: '\u2637',
  Settings: '\u2699',
  Server: '\u229E',
  /** Distinct from Layers (☰) for menu affordance */
  Menu: '\u2261',
  Close: '\u2715',
};
