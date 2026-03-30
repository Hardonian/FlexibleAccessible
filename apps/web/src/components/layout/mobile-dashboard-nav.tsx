'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DASHBOARD_NAV_ITEMS, NAV_ICON_MAP, type OrgInfo } from './dashboard-nav-config';
import { useDashboardNav } from './dashboard-nav-context';

interface MobileDashboardNavProps {
  orgs: OrgInfo[];
  user: { id: string; email: string; name: string | null };
  canViewSystem?: boolean;
}

export function MobileDashboardNav({ orgs, user, canViewSystem }: MobileDashboardNavProps) {
  const pathname = usePathname();
  const { mobileNavOpen, closeMobileNav } = useDashboardNav();
  const [currentOrg, setCurrentOrg] = useState(orgs[0]);
  const panelRef = useRef<HTMLElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    closeMobileNav();
  }, [pathname, closeMobileNav]);

  useEffect(() => {
    if (orgs.length === 0) return;
    setCurrentOrg((prev) => {
      if (prev && orgs.some((o) => o.id === prev.id)) return prev;
      return orgs[0];
    });
  }, [orgs]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobileNav();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    queueMicrotask(() => firstLinkRef.current?.focus());
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [mobileNavOpen, closeMobileNav]);

  if (!mobileNavOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Main menu">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        aria-label="Close menu"
        onClick={closeMobileNav}
      />
      <aside
        ref={panelRef}
        className="absolute left-0 top-0 flex h-full w-[min(20rem,88vw)] flex-col border-r border-slate-200 bg-white shadow-xl"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4">
          <Link href="/dashboard" className="text-lg font-bold text-brand-600" onClick={closeMobileNav}>
            AROS
          </Link>
          <button
            type="button"
            className="btn-ghost min-h-[44px] min-w-[44px] px-3"
            onClick={closeMobileNav}
            aria-label="Close navigation"
          >
            <span aria-hidden="true">{NAV_ICON_MAP.Close}</span>
          </button>
        </div>

        <div className="border-b border-slate-200 p-3">
          <label htmlFor="org-select-mobile" className="sr-only">
            Select organization
          </label>
          <select
            id="org-select-mobile"
            className="input text-sm"
            value={currentOrg?.id ?? ''}
            onChange={(e) => {
              const org = orgs.find((o) => o.id === e.target.value);
              if (org) setCurrentOrg(org);
            }}
            disabled={orgs.length === 0}
          >
            {orgs.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        <nav className="flex-1 overflow-y-auto p-3" aria-label="Main">
          <ul className="space-y-1" role="list">
            {DASHBOARD_NAV_ITEMS.map((item, i) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <li key={item.href}>
                  <Link
                    ref={i === 0 ? firstLinkRef : undefined}
                    href={item.href}
                    className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={closeMobileNav}
                  >
                    <span className="w-5 text-center" aria-hidden="true">
                      {NAV_ICON_MAP[item.icon]}
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
                  className={`flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    pathname === '/system' || pathname.startsWith('/system/')
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  aria-current={pathname.startsWith('/system') ? 'page' : undefined}
                  onClick={closeMobileNav}
                >
                  <span className="w-5 text-center" aria-hidden="true">
                    {NAV_ICON_MAP.Server}
                  </span>
                  System
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-medium text-brand-700">
              {(user.name ?? user.email).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{user.name ?? 'User'}</p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
