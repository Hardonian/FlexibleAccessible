'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MemberRole } from '@aros/db';

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  role: MemberRole;
  workspaces: Array<{ id: string; name: string; slug: string }>;
}

interface SidebarProps {
  orgs: OrgInfo[];
  user: { id: string; email: string; name: string | null };
  canViewSystem?: boolean;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/sites', label: 'Sites', icon: 'Globe' },
  { href: '/findings', label: 'Findings', icon: 'AlertTriangle' },
  { href: '/clusters', label: 'Clusters', icon: 'Layers' },
  { href: '/remediation', label: 'Remediation', icon: 'Wrench' },
  { href: '/reviews', label: 'Reviews', icon: 'CheckSquare' },
  { href: '/reports', label: 'Reports', icon: 'FileText' },
  { href: '/settings', label: 'Settings', icon: 'Settings' },
];

export function Sidebar({ orgs, user, canViewSystem }: SidebarProps) {
  const pathname = usePathname();
  const [currentOrg, setCurrentOrg] = useState(orgs[0]);

  return (
    <aside className="flex w-64 flex-col border-r border-slate-200 bg-white" role="navigation" aria-label="Main navigation">
      <div className="flex h-14 items-center border-b border-slate-200 px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-lg font-bold text-brand-600">AROS</span>
        </Link>
      </div>

      {/* Org Switcher */}
      <div className="border-b border-slate-200 p-3">
        <label htmlFor="org-select" className="sr-only">Select organization</label>
        <select
          id="org-select"
          value={currentOrg?.id ?? ''}
          onChange={(e) => {
            const org = orgs.find((o) => o.id === e.target.value);
            if (org) setCurrentOrg(org);
          }}
          className="input text-sm"
        >
          {orgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1" role="list">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="w-5 text-center" aria-hidden="true">
                    {iconMap[item.icon]}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
          {canViewSystem && (
            <li>
              <Link
                href="/system"
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  pathname === '/system' || pathname.startsWith('/system/')
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                aria-current={pathname.startsWith('/system') ? 'page' : undefined}
              >
                <span className="w-5 text-center" aria-hidden="true">
                  {iconMap.Server}
                </span>
                System
              </Link>
            </li>
          )}
        </ul>
      </nav>

      {/* User */}
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-medium text-brand-700">
            {(user.name ?? user.email).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">
              {user.name ?? 'User'}
            </p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

const iconMap: Record<string, string> = {
  LayoutDashboard: '\u25A0',
  Globe: '\u25CB',
  AlertTriangle: '\u26A0',
  Layers: '\u2630',
  Wrench: '\u2692',
  CheckSquare: '\u2611',
  FileText: '\u2637',
  Settings: '\u2699',
  Server: '\u229E',
};
